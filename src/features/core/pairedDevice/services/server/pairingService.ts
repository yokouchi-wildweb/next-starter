// src/features/core/pairedDevice/services/server/pairingService.ts
//
// ペアリング（端末トークンを受け取るための一時的なコード）。2 つの始め方がある。
//
// A. admin_issued（管理者がコードを発行し、端末で入力する）
//    issuePairingCode → 端末が claimPairingCode → トークン発行
// B. device_initiated（端末がコード / QR を表示し、管理者が自分の端末で承認する）
//    端末が startDevicePairing（pendingToken を Cookie に保存）→ 管理者が approveDevicePairing
//    → 端末が pollDevicePairing（pendingToken で照合）→ トークン発行
//    コードを見ただけの第三者はトークンを受け取れない（pendingToken を持つ開始した端末だけが受け取る）。
//
// コードの総当たりは、有効期限（ttlMinutes）とルートのレート制限で防ぐ。
// 同じ端末に新しいコードを発行すると、その端末の未使用コードは取り消される。

import { and, desc, eq, gt, inArray, lt } from "drizzle-orm";

import { PAIRED_DEVICE_CONFIG } from "@/config/app/paired-device.config";
import { auditLogger } from "@/features/core/auditLog/services/server";
import { DEVICE_PAIRING_AUDIT_TARGET } from "@/features/core/pairedDevice/constants";
import { DevicePairingTable } from "@/features/core/pairedDevice/entities/drizzle";
import type {
  DevicePairing,
  DevicePairingRequestForApprover,
  EffectiveDevicePairingStatus,
  PairedDevice,
  SessionDevice,
} from "@/features/core/pairedDevice/entities/model";
import type { ApproveDevicePairingInput } from "@/features/core/pairedDevice/entities/schema";
import {
  formatShortCode,
  generateSecretToken,
  generateShortCode,
  hashSecretToken,
  normalizeShortCode,
} from "@/lib/crypto";
import { createDeadline, runBudgetedBatches, type RunBudgetedBatchesResult } from "@/lib/cron";
import { db } from "@/lib/drizzle";

import {
  createPairedDevice,
  getManagedPairedDevice,
  resolvePairedDeviceState,
  type PairedDeviceActor,
} from "./deviceService";
import { issueDeviceToken, type DeviceRequestInfo } from "./deviceToken";
import {
  PairedDeviceError,
  assertPairedDeviceEnabled,
  assertPairingFlowAllowed,
  runDeviceVerify,
  safeParseDeviceScope,
} from "./kinds";
import { getPublicColumns } from "@/lib/crud/drizzle/hiddenColumns";

const MINUTE_MS = 60 * 1000;

const newExpiry = (): Date =>
  new Date(Date.now() + PAIRED_DEVICE_CONFIG.pairing.ttlMinutes * MINUTE_MS);

const hashCode = (code: string): string | null => {
  const normalized = normalizeShortCode(code);
  return normalized ? hashSecretToken(normalized) : null;
};

/** 期限切れを導出した実効ステータス */
export function resolvePairingStatus(
  pairing: Pick<DevicePairing, "status" | "expiresAt">,
  now: Date = new Date(),
): EffectiveDevicePairingStatus {
  if (
    (pairing.status === "pending" || pairing.status === "approved") &&
    pairing.expiresAt.getTime() <= now.getTime()
  ) {
    return "expired";
  }
  return pairing.status;
}

/** 実効ステータスが使えない状態なら理由付きで投げる */
function assertUsable(status: EffectiveDevicePairingStatus, expected: DevicePairing["status"]): void {
  if (status === expected) return;
  if (status === "expired") {
    throw new PairedDeviceError("expired", "コードの有効期限が切れています", 410);
  }
  if (status === "completed" || status === "canceled") {
    throw new PairedDeviceError("used", "このコードは使用済みか取り消されています", 410);
  }
  // pending を期待して approved だった等（別の流れのコード）
  throw new PairedDeviceError("not_found", "コードが見つかりません", 404);
}

type PairingRow = typeof DevicePairingTable.$inferSelect;

/** コードで行を引く（最新のものを優先）。flow が違うコードは存在しないものとして扱う */
async function findPairingByCode(
  code: string,
  flow: DevicePairing["flow"],
): Promise<PairingRow | null> {
  const codeHash = hashCode(code);
  if (!codeHash) return null;
  const rows = await db
    .select(getPublicColumns(DevicePairingTable))
    .from(DevicePairingTable)
    .where(and(eq(DevicePairingTable.codeHash, codeHash), eq(DevicePairingTable.flow, flow)))
    .orderBy(desc(DevicePairingTable.createdAt))
    .limit(5);
  // 同じコードが過去に使われていた場合に備え、新しい順に見て使える行を優先する（無ければ最新の行）
  const now = new Date();
  return (
    rows.find((row) => {
      const status = resolvePairingStatus(row, now);
      return status === "pending" || status === "approved";
    }) ??
    rows[0] ??
    null
  );
}

const toPairing = (row: PairingRow): DevicePairing => ({
  ...row,
  codeHash: null,
  pendingTokenHash: null,
});

export type IssuedPairingCode = {
  pairing: DevicePairing;
  /** 端末に入力するコード（表示用に区切った形）。この返却が唯一の取得機会 */
  code: string;
  expiresAt: Date;
};

/**
 * A. 管理者が端末のペアリングコードを発行する。
 * 失効済みの端末にも発行でき、ペアリングが成立すると失効が解除される（再ペアリング）。
 */
export async function issuePairingCode(
  deviceId: string,
  actor: PairedDeviceActor,
): Promise<IssuedPairingCode> {
  const device = await getManagedPairedDevice(deviceId, actor);
  assertPairingFlowAllowed(device.kind, "admin_issued");
  const rawCode = generateShortCode(PAIRED_DEVICE_CONFIG.pairing.codeLength);
  const expiresAt = newExpiry();

  const row = await db.transaction(async (tx) => {
    // 同じ端末の未使用コードは取り消す（有効なコードは常に 1 つ）
    await tx
      .update(DevicePairingTable)
      .set({ status: "canceled" })
      .where(
        and(
          eq(DevicePairingTable.deviceId, device.id),
          eq(DevicePairingTable.status, "pending"),
        ),
      );

    const [created] = await tx
      .insert(DevicePairingTable)
      .values({
        flow: "admin_issued",
        status: "pending",
        deviceId: device.id,
        codeHash: hashSecretToken(rawCode),
        expiresAt,
        createdBy: actor === "system" ? null : actor.userId,
      })
      .returning(getPublicColumns(DevicePairingTable));

    await auditLogger.record({
      targetType: DEVICE_PAIRING_AUDIT_TARGET,
      targetId: created.id,
      action: "paired_device.pairing.issued",
      after: { deviceId: device.id, flow: "admin_issued", expiresAt: expiresAt.toISOString() },
      tx,
    });
    return created;
  });

  return { pairing: toPairing(row), code: formatShortCode(rawCode), expiresAt };
}

export type CompletedPairing = {
  device: SessionDevice;
  /** Cookie に入れる生トークン */
  token: string;
  expiresAt: Date;
};

/** トークン発行の共通処理（状態遷移を条件付きで行い、二重受け取りを防ぐ） */
async function completePairing(
  row: PairingRow,
  fromStatus: "pending" | "approved",
  request: DeviceRequestInfo,
): Promise<CompletedPairing> {
  if (!row.deviceId) {
    throw new PairedDeviceError("not_found", "コードが見つかりません", 404);
  }
  const device = await getManagedPairedDevice(row.deviceId, "system");
  const parsed = safeParseDeviceScope(device.kind, device.scope);
  if (!parsed) {
    throw new PairedDeviceError("invalid_scope", "端末の設定が不正です。管理者に確認してください", 409);
  }
  // 発行の直前にも kind の verify を通す（例: 店舗の回線以外で受け取らせない）。
  // 失敗してもペアリングは消費しない（正しい場所からやり直せる）
  const verified = await runDeviceVerify(parsed.definition, {
    deviceId: device.id,
    kind: device.kind,
    scope: parsed.scope,
    ip: request.ip,
    userAgent: request.userAgent,
  });
  if (!verified) {
    throw new PairedDeviceError("forbidden", "この場所・機材ではこの端末を登録できません", 403);
  }

  return db.transaction(async (tx) => {
    const now = new Date();
    const updated = await tx
      .update(DevicePairingTable)
      .set({ status: "completed", completedAt: now })
      .where(
        and(
          eq(DevicePairingTable.id, row.id),
          eq(DevicePairingTable.status, fromStatus),
          gt(DevicePairingTable.expiresAt, now),
        ),
      )
      .returning({ id: DevicePairingTable.id });
    if (updated.length === 0) {
      // 同時に別のリクエストが受け取った、または直前に期限切れ・取り消し
      throw new PairedDeviceError("used", "このコードは使用済みか取り消されています", 410);
    }

    const issued = await issueDeviceToken(
      {
        deviceId: device.id,
        kind: device.kind,
        pairingId: row.id,
        userAgent: request.userAgent,
        ip: request.ip,
      },
      tx,
    );

    return {
      device: { deviceId: device.id, kind: device.kind, label: device.label, scope: parsed.scope },
      token: issued.token,
      expiresAt: issued.expiresAt,
    };
  });
}

/** A. 端末が管理者から受け取ったコードを送り、端末トークンを受け取る */
export async function claimPairingCode(
  code: string,
  request: DeviceRequestInfo,
): Promise<CompletedPairing> {
  assertPairedDeviceEnabled();
  const row = await findPairingByCode(code, "admin_issued");
  if (!row) {
    throw new PairedDeviceError("not_found", "コードが見つかりません", 404);
  }
  assertUsable(resolvePairingStatus(row), "pending");
  return completePairing(row, "pending", request);
}

export type StartedDevicePairing = {
  pairingId: string;
  /** 端末の画面に表示するコード（表示用に区切った形）。QR には承認ページの URL と一緒に入れる */
  code: string;
  /** 開始した端末だけが持つ照合トークン。httpOnly Cookie に入れ、pollDevicePairing で使う */
  pendingToken: string;
  expiresAt: Date;
};

/** B. 端末がペアリングを始める（管理者の承認待ちのコードを発行する） */
export async function startDevicePairing(request: DeviceRequestInfo): Promise<StartedDevicePairing> {
  assertPairedDeviceEnabled();
  const rawCode = generateShortCode(PAIRED_DEVICE_CONFIG.pairing.codeLength);
  const pendingToken = generateSecretToken();
  const expiresAt = newExpiry();

  const [created] = await db
    .insert(DevicePairingTable)
    .values({
      flow: "device_initiated",
      status: "pending",
      codeHash: hashSecretToken(rawCode),
      pendingTokenHash: hashSecretToken(pendingToken),
      expiresAt,
      requestIp: request.ip,
      requestUserAgent: request.userAgent,
    })
    .returning({ id: DevicePairingTable.id });

  return { pairingId: created.id, code: formatShortCode(rawCode), pendingToken, expiresAt };
}

/**
 * B. 承認画面用に、端末側から始めたペアリングの情報を返す（承認者が端末を確かめる材料）。
 * 権限の確認は承認時に行う（この時点では割り当て先の端末が決まっていない）。
 */
export async function getDevicePairingRequest(
  code: string,
  approver: { ip: string | null } = { ip: null },
): Promise<DevicePairingRequestForApprover> {
  assertPairedDeviceEnabled();
  const row = await findPairingByCode(code, "device_initiated");
  if (!row) {
    throw new PairedDeviceError("not_found", "コードが見つかりません", 404);
  }
  return {
    id: row.id,
    status: resolvePairingStatus(row),
    expiresAt: row.expiresAt,
    requestIp: row.requestIp,
    requestUserAgent: row.requestUserAgent,
    // 参考情報（認可条件にはしない）。店内の同じ回線から承認しているかの目安
    sameNetworkAsApprover:
      row.requestIp && approver.ip ? row.requestIp === approver.ip : null,
    createdAt: row.createdAt,
  };
}

/**
 * B. 管理者が端末側から始めたペアリングを承認し、端末を割り当てる。
 * 既存の端末を割り当てる（deviceId）か、その場で登録する（device）。どちらも管理権限が要る。
 */
export async function approveDevicePairing(
  input: ApproveDevicePairingInput,
  actor: PairedDeviceActor,
): Promise<{ pairing: DevicePairing; device: PairedDevice }> {
  assertPairedDeviceEnabled();
  const row = await findPairingByCode(input.code, "device_initiated");
  if (!row) {
    throw new PairedDeviceError("not_found", "コードが見つかりません", 404);
  }
  assertUsable(resolvePairingStatus(row), "pending");

  const existing = "deviceId" in input ? await getManagedPairedDevice(input.deviceId, actor) : null;
  assertPairingFlowAllowed(existing ? existing.kind : "device" in input ? input.device.kind : "", "device_initiated");
  // 稼働中の端末に割り当てると今の端末は使えなくなる。取り違えを防ぐため明示を求める
  const replacedActive = !!existing && resolvePairedDeviceState(existing) === "active";
  if (replacedActive && !("replaceActive" in input && input.replaceActive)) {
    throw new PairedDeviceError(
      "device_active",
      "この端末は稼働中です。置き換える場合は確認のうえやり直してください",
      409,
    );
  }

  return db.transaction(async (tx) => {
    const device =
      existing ?? ("device" in input ? await createPairedDevice(input.device, actor, tx) : null);
    if (!device) {
      throw new PairedDeviceError("not_found", "端末が見つかりません", 404);
    }
    const now = new Date();

    // 同じ端末の未使用コードは取り消す（有効なコードは常に 1 つ）
    await tx
      .update(DevicePairingTable)
      .set({ status: "canceled" })
      .where(
        and(
          eq(DevicePairingTable.deviceId, device.id),
          inArray(DevicePairingTable.status, ["pending", "approved"]),
        ),
      );

    const updated = await tx
      .update(DevicePairingTable)
      .set({
        status: "approved",
        deviceId: device.id,
        approvedBy: actor === "system" ? null : actor.userId,
        approvedAt: now,
      })
      .where(
        and(
          eq(DevicePairingTable.id, row.id),
          eq(DevicePairingTable.status, "pending"),
          gt(DevicePairingTable.expiresAt, now),
        ),
      )
      .returning(getPublicColumns(DevicePairingTable));
    if (updated.length === 0) {
      throw new PairedDeviceError("used", "このコードは使用済みか取り消されています", 410);
    }

    await auditLogger.record({
      targetType: DEVICE_PAIRING_AUDIT_TARGET,
      targetId: row.id,
      action: "paired_device.pairing.approved",
      after: { deviceId: device.id, flow: "device_initiated", replacedActive },
      metadata: { requestIp: row.requestIp, requestUserAgent: row.requestUserAgent },
      tx,
    });

    return { pairing: toPairing(updated[0]), device };
  });
}

export type DevicePairingPollResult =
  | { status: "pending" | "expired" | "canceled"; expiresAt: Date }
  | ({ status: "completed" } & CompletedPairing);

/**
 * B. 端末が承認を確認しに来る。承認済みならトークンを発行する（1 回だけ）。
 * pendingToken が一致しない・存在しないは not_found。
 */
export async function pollDevicePairing(
  pendingToken: string,
  request: DeviceRequestInfo,
): Promise<DevicePairingPollResult> {
  assertPairedDeviceEnabled();
  if (!pendingToken) {
    throw new PairedDeviceError("not_found", "ペアリングが見つかりません", 404);
  }
  const rows = await db
    .select(getPublicColumns(DevicePairingTable))
    .from(DevicePairingTable)
    .where(
      and(
        eq(DevicePairingTable.pendingTokenHash, hashSecretToken(pendingToken)),
        eq(DevicePairingTable.flow, "device_initiated"),
      ),
    )
    .limit(1);
  const row = rows[0];
  if (!row) {
    throw new PairedDeviceError("not_found", "ペアリングが見つかりません", 404);
  }

  const status = resolvePairingStatus(row);
  if (status === "approved") {
    const completed = await completePairing(row, "approved", request);
    return { status: "completed", ...completed };
  }
  if (status === "completed") {
    // 受け取り済み（別タブ等）。トークンは再発行しない
    throw new PairedDeviceError("used", "このペアリングは完了しています", 410);
  }
  return { status, expiresAt: row.expiresAt };
}

/** 未使用のペアリングを取り消す（管理者） */
export async function cancelDevicePairing(
  pairingId: string,
  actor: PairedDeviceActor,
): Promise<void> {
  assertPairedDeviceEnabled();
  const rows = await db
    .select(getPublicColumns(DevicePairingTable))
    .from(DevicePairingTable)
    .where(eq(DevicePairingTable.id, pairingId))
    .limit(1);
  const row = rows[0];
  if (!row) {
    throw new PairedDeviceError("not_found", "ペアリングが見つかりません", 404);
  }
  if (row.deviceId) {
    await getManagedPairedDevice(row.deviceId, actor);
  } else if (actor !== "system") {
    // 割り当て前の端末側ペアリングは、誰の管理範囲か決まらないので system だけが取り消せる
    // （放置しても有効期限で失効する）
    throw new PairedDeviceError("forbidden", "このペアリングを取り消す権限がありません", 403);
  }

  await db.transaction(async (tx) => {
    const updated = await tx
      .update(DevicePairingTable)
      .set({ status: "canceled" })
      .where(
        and(
          eq(DevicePairingTable.id, pairingId),
          inArray(DevicePairingTable.status, ["pending", "approved"]),
        ),
      )
      .returning({ id: DevicePairingTable.id });
    if (updated.length === 0) return;
    await auditLogger.record({
      targetType: DEVICE_PAIRING_AUDIT_TARGET,
      targetId: pairingId,
      action: "paired_device.pairing.canceled",
      tx,
    });
  });
}

/** 端末の未使用ペアリング（管理画面で「コード発行中」を出す用） */
export async function listActivePairingsForDevice(
  deviceId: string,
  actor: PairedDeviceActor,
): Promise<DevicePairing[]> {
  await getManagedPairedDevice(deviceId, actor);
  const now = new Date();
  const rows = await db
    .select(getPublicColumns(DevicePairingTable))
    .from(DevicePairingTable)
    .where(
      and(
        eq(DevicePairingTable.deviceId, deviceId),
        inArray(DevicePairingTable.status, ["pending", "approved"]),
        gt(DevicePairingTable.expiresAt, now),
      ),
    );
  return rows.map(toPairing);
}

/** 1 チャンクで削除する行数 */
const PRUNE_CHUNK_SIZE = 1000;

/**
 * 期限切れから一定時間たったペアリングを削除する（cron）。
 * 端末側から始めるペアリングは公開ルートから作られ、行数に上限がないため、時間予算付きで削除する。
 */
export async function pruneExpiredDevicePairings(
  options: { olderThanHours?: number; budgetMs?: number } = {},
): Promise<RunBudgetedBatchesResult> {
  const boundary = new Date(Date.now() - (options.olderThanHours ?? 24) * 60 * MINUTE_MS);
  return runBudgetedBatches<string, null>({
    deadline: createDeadline(options.budgetMs ?? 240_000),
    fetchNext: async () => {
      const rows = await db
        .select({ id: DevicePairingTable.id })
        .from(DevicePairingTable)
        .where(lt(DevicePairingTable.expiresAt, boundary))
        .limit(PRUNE_CHUNK_SIZE);
      return { items: rows.map((row) => row.id), cursor: null };
    },
    processChunk: async (ids) => {
      await db.delete(DevicePairingTable).where(inArray(DevicePairingTable.id, ids));
    },
  });
}
