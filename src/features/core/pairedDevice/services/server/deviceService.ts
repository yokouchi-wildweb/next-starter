// src/features/core/pairedDevice/services/server/deviceService.ts
//
// 端末の登録・変更・失効・一覧（管理者側の操作）。すべて server-only。
// 権限は kind の manageableScopes で判定する（admin カテゴリは常に全件）。
// actor に "system" を渡すと権限判定を省く（CLI・cron 用。HTTP ルートからは必ずユーザーを渡す）。

import { and, eq, inArray, isNull, sql, type SQL } from "drizzle-orm";

import { PAIRED_DEVICE_CONFIG } from "@/config/app/paired-device.config";
import { auditLogger } from "@/features/core/auditLog/services/server";
import type { SessionUser } from "@/features/core/auth/entities/session";
import {
  PAIRED_DEVICE_AUDIT_TARGET,
  type DevicePairingFlow,
} from "@/features/core/pairedDevice/constants";
import { DevicePairingTable, PairedDeviceTable } from "@/features/core/pairedDevice/entities/drizzle";
import type {
  PairedDevice,
  PairedDeviceForAdmin,
  PairedDeviceState,
} from "@/features/core/pairedDevice/entities/model";
import type {
  CreatePairedDeviceInput,
  ListPairedDevicesInput,
  UpdatePairedDeviceInput,
} from "@/features/core/pairedDevice/entities/schema";
import type { DbTransaction } from "@/lib/crud/drizzle";
import { db } from "@/lib/drizzle";

import { isValidScopePattern } from "@/features/core/pairedDevice/utils/scopeContains";

import { pairedDeviceBase } from "./drizzleBase";
import { isIdleExpired, resolveIdleRevokeDays } from "./deviceToken";
import {
  PairedDeviceError,
  assertCanManagePairedDevice,
  assertPairedDeviceEnabled,
  buildManageableDevicesWhere,
  getAllowedPairingFlows,
  getPairedDeviceKind,
  listPairedDeviceKinds,
  parseDeviceScope,
  resolveManageableScopes,
} from "./kinds";
import { getPublicColumns } from "@/lib/crud/drizzle/hiddenColumns";

/** 操作者。HTTP ルートはセッションユーザー、CLI・cron は "system" */
export type PairedDeviceActor = SessionUser | "system";

const actorUserId = (actor: PairedDeviceActor): string | null =>
  actor === "system" ? null : actor.userId;

async function assertActorCanManage(
  actor: PairedDeviceActor,
  kind: string,
  scope: unknown,
): Promise<void> {
  if (actor === "system") return;
  await assertCanManagePairedDevice(actor, kind, scope);
}

/** 端末の状態を導出する */
export function resolvePairedDeviceState(
  device: Pick<PairedDevice, "kind" | "revokedAt" | "tokenExpiresAt" | "lastSeenAt">,
  now: Date = new Date(),
): PairedDeviceState {
  if (device.revokedAt) return "revoked";
  if (!device.tokenExpiresAt) return "unpaired";
  if (device.tokenExpiresAt.getTime() <= now.getTime()) return "expired";
  const idleDays = resolveIdleRevokeDays(getPairedDeviceKind(device.kind));
  if (isIdleExpired(device.lastSeenAt, idleDays, now)) return "expired";
  return "active";
}

/** 管理者向けの形に変換する（トークン関連の内部値を落とし、状態とオンライン判定を付ける） */
export function toPairedDeviceForAdmin(
  device: PairedDevice,
  now: Date = new Date(),
): PairedDeviceForAdmin {
  const state = resolvePairedDeviceState(device, now);
  const online =
    state === "active" &&
    !!device.lastSeenAt &&
    now.getTime() - device.lastSeenAt.getTime() <= PAIRED_DEVICE_CONFIG.onlineThresholdSeconds * 1000;
  return {
    id: device.id,
    label: device.label,
    kind: device.kind,
    scope: device.scope,
    state,
    online,
    tokenExpiresAt: device.tokenExpiresAt,
    pairedAt: device.pairedAt,
    pairedUserAgent: device.pairedUserAgent,
    lastSeenAt: device.lastSeenAt,
    lastSeenIp: device.lastSeenIp,
    createdBy: device.createdBy,
    revokedAt: device.revokedAt,
    revokedBy: device.revokedBy,
    createdAt: device.createdAt,
    updatedAt: device.updatedAt,
  };
}

/** 端末を 1 件取得する（存在しなければ 404） */
async function findDeviceOrThrow(id: string): Promise<PairedDevice> {
  const device = (await pairedDeviceBase.get(id).catch(() => null)) as PairedDevice | null;
  if (!device) {
    throw new PairedDeviceError("not_found", "端末が見つかりません", 404);
  }
  return device;
}

/**
 * 管理対象の端末を取得する。存在しない・管理権限がないは区別せず 404
 * （管理できない端末の存在を漏らさない）。
 */
export async function getManagedPairedDevice(
  id: string,
  actor: PairedDeviceActor,
): Promise<PairedDevice> {
  assertPairedDeviceEnabled();
  const device = await findDeviceOrThrow(id);
  try {
    await assertActorCanManage(actor, device.kind, device.scope);
  } catch {
    throw new PairedDeviceError("not_found", "端末が見つかりません", 404);
  }
  return device;
}

/** 端末を登録する（未ペアリングの状態で作られる。続けてペアリングコードを発行する） */
export async function createPairedDevice(
  input: CreatePairedDeviceInput,
  actor: PairedDeviceActor,
  tx?: DbTransaction,
): Promise<PairedDevice> {
  assertPairedDeviceEnabled();
  const scope = parseDeviceScope(input.kind, input.scope);
  await assertActorCanManage(actor, input.kind, scope);

  const run = async (executor: DbTransaction) => {
    const created = (await pairedDeviceBase.create(
      { label: input.label, kind: input.kind, scope, createdBy: actorUserId(actor) },
      executor,
    )) as unknown as PairedDevice;

    await auditLogger.record({
      targetType: PAIRED_DEVICE_AUDIT_TARGET,
      targetId: created.id,
      action: "paired_device.device.created",
      after: { label: created.label, kind: created.kind, scope: created.scope },
      tx: executor,
    });
    return created;
  };

  return tx ? run(tx) : db.transaction(run);
}

/** 端末の名前変更・scope の付け替え（再ペアリングは不要。次のリクエストから新しい scope が効く） */
export async function updatePairedDevice(
  id: string,
  input: UpdatePairedDeviceInput,
  actor: PairedDeviceActor,
): Promise<PairedDevice> {
  const device = await getManagedPairedDevice(id, actor);
  const nextScope =
    input.scope !== undefined ? parseDeviceScope(device.kind, input.scope) : undefined;
  if (nextScope !== undefined) {
    // 付け替え先も管理できる範囲でなければならない
    await assertActorCanManage(actor, device.kind, nextScope);
  }

  return db.transaction(async (tx) => {
    const updated = (await pairedDeviceBase.update(
      id,
      {
        ...(input.label !== undefined ? { label: input.label } : {}),
        ...(nextScope !== undefined ? { scope: nextScope } : {}),
      },
      tx,
    )) as unknown as PairedDevice;

    if (input.label !== undefined && input.label !== device.label) {
      await auditLogger.record({
        targetType: PAIRED_DEVICE_AUDIT_TARGET,
        targetId: id,
        action: "paired_device.device.renamed",
        before: { label: device.label },
        after: { label: updated.label },
        tx,
      });
    }
    if (nextScope !== undefined && JSON.stringify(nextScope) !== JSON.stringify(device.scope)) {
      await auditLogger.record({
        targetType: PAIRED_DEVICE_AUDIT_TARGET,
        targetId: id,
        action: "paired_device.device.scope_changed",
        before: { scope: device.scope },
        after: { scope: updated.scope },
        tx,
      });
    }
    return updated;
  });
}

/**
 * 端末を失効させる。次のリクエストから認証に失敗する。
 * トークンを消し、未使用のペアリングコードも取り消す。再ペアリングすれば再び使える。
 */
export async function revokePairedDevice(
  id: string,
  actor: PairedDeviceActor,
  options: { reason?: string | null } = {},
): Promise<PairedDevice> {
  const device = await getManagedPairedDevice(id, actor);
  if (device.revokedAt) return device;

  return db.transaction(async (tx) => {
    const now = new Date();
    const rows = await tx
      .update(PairedDeviceTable)
      .set({
        tokenHash: null,
        tokenExpiresAt: null,
        revokedAt: now,
        revokedBy: actorUserId(actor),
        updatedAt: now,
      })
      .where(eq(PairedDeviceTable.id, id))
      .returning(getPublicColumns(PairedDeviceTable));

    await tx
      .update(DevicePairingTable)
      .set({ status: "canceled" })
      .where(
        and(
          eq(DevicePairingTable.deviceId, id),
          inArray(DevicePairingTable.status, ["pending", "approved"]),
        ),
      );

    await auditLogger.record({
      targetType: PAIRED_DEVICE_AUDIT_TARGET,
      targetId: id,
      action: "paired_device.device.revoked",
      reason: options.reason ?? null,
      tx,
    });

    const row = rows[0];
    return { ...row, tokenHash: null } as PairedDevice;
  });
}

export type PairedDeviceScopeQuery = {
  /** 対象の種類。省略時はすべての種類 */
  kind?: string;
  /**
   * scope の部分オブジェクト（JSONB の @> と同じ包含判定。例: { storeId, tableId }）。
   * キーを 1 つ以上持ち、値が JSON に損失なく往復できること（{} や undefined を含む指定は 400）。
   * 全件を対象にする指定は受け付けない（一括失効の事故を防ぐため）
   */
  scope: Record<string, unknown>;
};

function buildScopeQueryWhere(query: PairedDeviceScopeQuery, includeRevoked: boolean): SQL {
  if (!isValidScopePattern(query.scope)) {
    throw new PairedDeviceError(
      "invalid_scope",
      "scope の指定が不正です（キーを 1 つ以上持ち、値に undefined などを含まないこと）",
      400,
    );
  }
  const clauses: SQL[] = [sql`${PairedDeviceTable.scope} @> ${JSON.stringify(query.scope)}::jsonb`];
  if (query.kind) clauses.push(eq(PairedDeviceTable.kind, query.kind));
  if (!includeRevoked) clauses.push(isNull(PairedDeviceTable.revokedAt));
  return and(...clauses) as SQL;
}

/**
 * scope を含む端末の一覧（一括失効の対象の確認・プレビュー用。ページングなし）。
 * actor がユーザーなら、管理できない端末が 1 台でも含まれると forbidden（403）。
 */
export async function listPairedDevicesByScope(
  query: PairedDeviceScopeQuery & { includeRevoked?: boolean },
  options: { actor: PairedDeviceActor; tx?: DbTransaction },
): Promise<PairedDeviceForAdmin[]> {
  assertPairedDeviceEnabled();
  const executor = options.tx ?? db;
  const rows = await executor
    .select(getPublicColumns(PairedDeviceTable))
    .from(PairedDeviceTable)
    .where(buildScopeQueryWhere(query, query.includeRevoked ?? false));
  for (const row of rows) {
    await assertActorCanManage(options.actor, row.kind, row.scope);
  }
  const now = new Date();
  return rows.map((row) => toPairedDeviceForAdmin({ ...row, tokenHash: null } as PairedDevice, now));
}

/**
 * scope を含む端末をまとめて失効させる。次のリクエストから認証に失敗する。
 *
 * 用途: downstream のデータ変更（テーブルの削除・別店舗への移動等）で scope が古くなった端末を、
 * その変更と同じトランザクションの中で止める（kind.verify で毎回 DB を引かずに済む）。
 * 端末を別の場所に移すだけなら、失効ではなく updatePairedDevice で scope を付け替えてもよい。
 *
 * - tx を渡すとその中で実行する（呼び出し側の削除・移動と一緒にロールバックされる）
 * - actor がユーザーなら、対象の全端末を管理できなければ forbidden（403）で何も失効させない
 * - 1 台ずつ paired_device.device.revoked を監査ログに残す（metadata.bulk = true）
 * - 未使用のペアリングコードも取り消す。失効済みの端末は対象外
 */
export async function revokePairedDevicesByScope(
  query: PairedDeviceScopeQuery & { reason?: string | null },
  options: { actor: PairedDeviceActor; tx?: DbTransaction },
): Promise<{ count: number; deviceIds: string[] }> {
  assertPairedDeviceEnabled();
  const run = async (tx: DbTransaction) => {
    const targets = await tx
      .select({ id: PairedDeviceTable.id, kind: PairedDeviceTable.kind, scope: PairedDeviceTable.scope })
      .from(PairedDeviceTable)
      .where(buildScopeQueryWhere(query, false));
    for (const target of targets) {
      await assertActorCanManage(options.actor, target.kind, target.scope);
    }
    if (targets.length === 0) return { count: 0, deviceIds: [] };

    const ids = targets.map((target) => target.id);
    const now = new Date();
    const revoked = await tx
      .update(PairedDeviceTable)
      .set({
        tokenHash: null,
        tokenExpiresAt: null,
        revokedAt: now,
        revokedBy: actorUserId(options.actor),
        updatedAt: now,
      })
      .where(and(inArray(PairedDeviceTable.id, ids), isNull(PairedDeviceTable.revokedAt)))
      .returning({ id: PairedDeviceTable.id });
    const revokedIds = revoked.map((row) => row.id);
    if (revokedIds.length === 0) return { count: 0, deviceIds: [] };

    await tx
      .update(DevicePairingTable)
      .set({ status: "canceled" })
      .where(
        and(
          inArray(DevicePairingTable.deviceId, revokedIds),
          inArray(DevicePairingTable.status, ["pending", "approved"]),
        ),
      );

    await auditLogger.recordMany(
      revokedIds.map((id) => ({
        targetType: PAIRED_DEVICE_AUDIT_TARGET,
        targetId: id,
        action: "paired_device.device.revoked",
        reason: query.reason ?? null,
        metadata: { bulk: true, kind: query.kind ?? null, scope: query.scope },
        tx,
      })),
    );
    return { count: revokedIds.length, deviceIds: revokedIds };
  };
  return options.tx ? run(options.tx) : db.transaction(run);
}

/**
 * 端末自身が登録を解除する（端末の画面の「この端末の登録を解除」）。
 * トークンを消すだけで失効にはしない（管理者は再ペアリングで戻せる）。呼び出し側で Cookie も消す。
 */
export async function unpairPairedDevice(deviceId: string): Promise<void> {
  assertPairedDeviceEnabled();
  await db.transaction(async (tx) => {
    const rows = await tx
      .update(PairedDeviceTable)
      .set({ tokenHash: null, tokenExpiresAt: null, updatedAt: new Date() })
      .where(eq(PairedDeviceTable.id, deviceId))
      .returning({ id: PairedDeviceTable.id });
    if (rows.length === 0) return;
    await auditLogger.record({
      targetType: PAIRED_DEVICE_AUDIT_TARGET,
      targetId: deviceId,
      action: "paired_device.device.unpaired",
      tx,
    });
  });
}

/** このユーザーが管理できる端末の種類（登録画面の選択肢用） */
export async function listManageablePairedDeviceKinds(
  actor: PairedDeviceActor,
): Promise<Array<{ kind: string; label: string; pairingFlows: readonly DevicePairingFlow[] }>> {
  assertPairedDeviceEnabled();
  const result: Array<{ kind: string; label: string; pairingFlows: readonly DevicePairingFlow[] }> = [];
  for (const kind of listPairedDeviceKinds()) {
    if (actor !== "system") {
      const scopes = await resolveManageableScopes(actor, kind);
      if (scopes !== "all" && scopes.length === 0) continue;
    }
    result.push({
      kind,
      label: getPairedDeviceKind(kind)?.label ?? kind,
      pairingFlows: getAllowedPairingFlows(kind),
    });
  }
  return result;
}

export type ListPairedDevicesResult = {
  results: PairedDeviceForAdmin[];
  total: number;
};

/**
 * 管理できる端末の一覧（ページング付き）。
 * kind / scope（JSONB の包含）で絞り込める。失効済みは includeRevoked を付けたときだけ含める。
 */
export async function listPairedDevices(
  input: ListPairedDevicesInput,
  actor: PairedDeviceActor,
): Promise<ListPairedDevicesResult> {
  assertPairedDeviceEnabled();
  const clauses: SQL[] = [];
  if (actor !== "system") {
    clauses.push(await buildManageableDevicesWhere(actor, input.kind));
  }
  if (input.kind) clauses.push(eq(PairedDeviceTable.kind, input.kind));
  if (input.scope) {
    clauses.push(sql`${PairedDeviceTable.scope} @> ${JSON.stringify(input.scope)}::jsonb`);
  }
  if (!input.includeRevoked) clauses.push(isNull(PairedDeviceTable.revokedAt));

  const result = await pairedDeviceBase.search({
    page: input.page ?? 1,
    limit: input.limit ?? 50,
    extraWhere: clauses.length > 0 ? (and(...clauses) as SQL) : undefined,
  });
  const now = new Date();
  return {
    results: (result.results as unknown as PairedDevice[]).map((device) =>
      toPairedDeviceForAdmin(device, now),
    ),
    total: result.total,
  };
}
