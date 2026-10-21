// src/features/core/pairedDevice/services/server/deviceToken.ts
//
// 端末トークンの発行と認証。生トークンは発行時に 1 回だけ返し、DB には SHA-256 だけ保存する。

import { and, eq, isNull, lt, or, sql } from "drizzle-orm";

import { PAIRED_DEVICE_CONFIG } from "@/config/app/paired-device.config";
import { auditLogger } from "@/features/core/auditLog/services/server";
import { PAIRED_DEVICE_AUDIT_TARGET } from "@/features/core/pairedDevice/constants";
import { PairedDeviceTable } from "@/features/core/pairedDevice/entities/drizzle";
import type { SessionDevice } from "@/features/core/pairedDevice/entities/model";
import type { PairedDeviceKindDefinition } from "@/features/core/pairedDevice/types/kind";
import type { DbTransaction } from "@/lib/crud/drizzle";
import { generateSecretToken, hashSecretToken } from "@/lib/crypto";
import { db, isDatabaseConfigured } from "@/lib/drizzle";

import { getPairedDeviceKind, safeParseDeviceScope } from "./kinds";

const DAY_MS = 24 * 60 * 60 * 1000;

/** kind の有効期間（日） */
export function resolveTokenMaxAgeDays(definition: PairedDeviceKindDefinition | null): number {
  return definition?.tokenMaxAgeDays ?? PAIRED_DEVICE_CONFIG.token.maxAgeDays;
}

/** kind の無操作失効までの日数（null = 無効化しない） */
export function resolveIdleRevokeDays(definition: PairedDeviceKindDefinition | null): number | null {
  if (definition && definition.idleRevokeDays !== undefined) return definition.idleRevokeDays;
  return PAIRED_DEVICE_CONFIG.token.idleRevokeDays;
}

/** 長期間アクセスがなく無効になっているか */
export function isIdleExpired(
  lastSeenAt: Date | null,
  idleRevokeDays: number | null,
  now: Date,
): boolean {
  if (idleRevokeDays === null || !lastSeenAt) return false;
  return lastSeenAt.getTime() + idleRevokeDays * DAY_MS < now.getTime();
}

export type IssuedDeviceToken = {
  /** Cookie に入れる生トークン。この返却が唯一の取得機会 */
  token: string;
  expiresAt: Date;
};

/**
 * 端末トークンを発行する（ペアリング成立時）。古いトークンは無効になり、失効状態も解除される。
 * 呼び出し側（pairingService）が tx を張り、権限と kind の検証を済ませていること。
 */
export async function issueDeviceToken(
  params: {
    deviceId: string;
    kind: string;
    pairingId: string;
    userAgent: string | null;
    ip: string | null;
  },
  tx: DbTransaction,
): Promise<IssuedDeviceToken> {
  const definition = getPairedDeviceKind(params.kind);
  const token = generateSecretToken();
  const now = new Date();
  const expiresAt = new Date(now.getTime() + resolveTokenMaxAgeDays(definition) * DAY_MS);

  await tx
    .update(PairedDeviceTable)
    .set({
      tokenHash: hashSecretToken(token),
      tokenExpiresAt: expiresAt,
      pairedAt: now,
      pairedUserAgent: params.userAgent,
      lastSeenAt: now,
      lastSeenIp: params.ip,
      revokedAt: null,
      revokedBy: null,
      updatedAt: now,
    })
    .where(eq(PairedDeviceTable.id, params.deviceId));

  await auditLogger.record({
    targetType: PAIRED_DEVICE_AUDIT_TARGET,
    targetId: params.deviceId,
    action: "paired_device.device.paired",
    after: { tokenExpiresAt: expiresAt.toISOString() },
    metadata: { pairingId: params.pairingId, ip: params.ip, userAgent: params.userAgent },
    tx,
  });

  return { token, expiresAt };
}

export type DeviceRequestInfo = {
  ip: string | null;
  userAgent: string | null;
};

export type AuthenticatedDevice = {
  device: SessionDevice;
  /**
   * 有効期限を延長した場合の新しい期限。呼び出し側は Cookie をこの期限で書き直す
   * （トークンの値は変わらない）。延長しなかった場合は null
   */
  refreshedExpiresAt: Date | null;
};

/**
 * 端末トークンを照合し、認証済みの端末を返す。無効なら null（理由は区別しない）。
 *
 * 判定: 機能が有効 / DB 設定済み / トークン一致 / 失効していない / 有効期限内 /
 * 長期間アクセスなしで無効になっていない / kind が登録済みで scope がスキーマに合う / verify フックが true。
 * 成功時は lastSeenAt を間引いて更新し、残り期間が短ければ有効期限を延長する。
 */
export async function authenticateDeviceToken(
  token: string,
  request: DeviceRequestInfo,
): Promise<AuthenticatedDevice | null> {
  if (!PAIRED_DEVICE_CONFIG.enabled || !isDatabaseConfigured()) return null;
  if (!token) return null;

  const rows = await db
    .select()
    .from(PairedDeviceTable)
    .where(eq(PairedDeviceTable.tokenHash, hashSecretToken(token)))
    .limit(1);
  const row = rows[0];
  if (!row || row.revokedAt || !row.tokenExpiresAt) return null;

  const now = new Date();
  if (row.tokenExpiresAt.getTime() <= now.getTime()) return null;

  const parsed = safeParseDeviceScope(row.kind, row.scope);
  if (!parsed) return null;
  if (isIdleExpired(row.lastSeenAt, resolveIdleRevokeDays(parsed.definition), now)) return null;

  if (parsed.definition.verify) {
    try {
      const ok = await parsed.definition.verify({
        deviceId: row.id,
        kind: row.kind,
        scope: parsed.scope,
        ip: request.ip,
        userAgent: request.userAgent,
      });
      if (!ok) return null;
    } catch (error) {
      console.warn("[pairedDevice] verify hook threw:", error);
      return null;
    }
  }

  const refreshedExpiresAt = await touchDevice(row.id, {
    lastSeenAt: row.lastSeenAt,
    tokenExpiresAt: row.tokenExpiresAt,
    maxAgeDays: resolveTokenMaxAgeDays(parsed.definition),
    ip: request.ip,
    now,
  });

  return {
    device: { deviceId: row.id, kind: row.kind, label: row.label, scope: parsed.scope },
    refreshedExpiresAt,
  };
}

/**
 * lastSeenAt の間引き更新と、有効期限のスライディング延長。延長した場合は新しい期限を返す。
 * 書き込みの失敗は認証を失敗させない（fail-soft。次のアクセスで再試行される）。
 */
async function touchDevice(
  deviceId: string,
  state: {
    lastSeenAt: Date | null;
    tokenExpiresAt: Date;
    maxAgeDays: number;
    ip: string | null;
    now: Date;
  },
): Promise<Date | null> {
  const { now } = state;
  const throttleMs = PAIRED_DEVICE_CONFIG.lastSeenThrottleSeconds * 1000;
  const shouldTouch = !state.lastSeenAt || state.lastSeenAt.getTime() + throttleMs <= now.getTime();
  const refreshThresholdMs = PAIRED_DEVICE_CONFIG.token.refreshWhenRemainingDays * DAY_MS;
  const shouldRefresh = state.tokenExpiresAt.getTime() - now.getTime() < refreshThresholdMs;
  if (!shouldTouch && !shouldRefresh) return null;

  const refreshedExpiresAt = shouldRefresh
    ? new Date(now.getTime() + state.maxAgeDays * DAY_MS)
    : null;

  try {
    // 同時アクセスで何度も書かないよう、条件付きで更新する
    const throttleBoundary = new Date(now.getTime() - throttleMs);
    await db
      .update(PairedDeviceTable)
      .set({
        lastSeenAt: now,
        lastSeenIp: state.ip,
        ...(refreshedExpiresAt ? { tokenExpiresAt: refreshedExpiresAt } : {}),
      })
      .where(
        and(
          eq(PairedDeviceTable.id, deviceId),
          isNull(PairedDeviceTable.revokedAt),
          refreshedExpiresAt
            ? sql`true`
            : or(
                isNull(PairedDeviceTable.lastSeenAt),
                lt(PairedDeviceTable.lastSeenAt, throttleBoundary),
              ),
        ),
      );
  } catch (error) {
    console.warn("[pairedDevice] failed to update last seen:", error);
    return null;
  }

  return refreshedExpiresAt;
}

/** 端末のトークンを無効にする（失効・再ペアリング前のリセット用）。tx 内で呼ぶ */
export async function clearDeviceToken(deviceId: string, tx: DbTransaction): Promise<void> {
  await tx
    .update(PairedDeviceTable)
    .set({ tokenHash: null, tokenExpiresAt: null, updatedAt: new Date() })
    .where(eq(PairedDeviceTable.id, deviceId));
}
