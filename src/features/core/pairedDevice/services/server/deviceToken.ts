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

/** ブラウザが Cookie の寿命を打ち切る上限（日）。これより長い有効期間は意味を持たない */
const MAX_TOKEN_AGE_DAYS = 400;

const isPositiveDays = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value) && value > 0;

/** kind の有効期間（日）。0 以下・400 超など不正な値は警告して config の値を使う */
export function resolveTokenMaxAgeDays(definition: PairedDeviceKindDefinition | null): number {
  const configured = definition?.tokenMaxAgeDays;
  if (configured !== undefined) {
    if (isPositiveDays(configured) && configured <= MAX_TOKEN_AGE_DAYS) return configured;
    console.warn(`[pairedDevice] invalid tokenMaxAgeDays (${configured}); using the config value`);
  }
  return Math.min(PAIRED_DEVICE_CONFIG.token.maxAgeDays, MAX_TOKEN_AGE_DAYS);
}

/** kind の無操作失効までの日数（null = 無効化しない）。不正な値は警告して config の値を使う */
export function resolveIdleRevokeDays(definition: PairedDeviceKindDefinition | null): number | null {
  if (definition && definition.idleRevokeDays !== undefined) {
    if (definition.idleRevokeDays === null || isPositiveDays(definition.idleRevokeDays)) {
      return definition.idleRevokeDays;
    }
    console.warn(`[pairedDevice] invalid idleRevokeDays (${definition.idleRevokeDays}); using the config value`);
  }
  return PAIRED_DEVICE_CONFIG.token.idleRevokeDays;
}

/**
 * 有効期限を延長する閾値（残り日数）。config の値と有効期間の 1/4 の小さい方。
 * 有効期間が閾値より短い kind で、アクセスのたびに延長（書き込み）が起きるのを防ぐ
 */
function resolveRefreshThresholdDays(maxAgeDays: number): number {
  return Math.min(PAIRED_DEVICE_CONFIG.token.refreshWhenRemainingDays, maxAgeDays / 4);
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
   * 端末トークンの現在の有効期限（このリクエストで延長した場合は延長後）。
   * Cookie を書ける応答では、延長したかどうかに関係なく毎回この期限で Cookie を書き直す
   * （DB と Cookie の期限がずれたまま Cookie だけ先に切れるのを防ぐ。トークンの値は変わらない）
   */
  tokenExpiresAt: Date;
};

export type AuthenticateDeviceOptions = {
  /**
   * 残りが短ければ有効期限を延長する（既定 true）。
   * Cookie を書けない経路（Server Component の getSessionDevice）は false にする。
   * DB の期限だけが延びて Cookie が取り残されるのを避けるため
   */
  extendExpiry?: boolean;
};

/**
 * 端末トークンを照合し、認証済みの端末を返す。無効なら null（理由は区別しない）。
 *
 * 判定: 機能が有効 / DB 設定済み / トークン一致 / 失効していない / 有効期限内 /
 * 長期間アクセスなしで無効になっていない / kind が登録済みで scope がスキーマに合う / verify フックが true。
 * 成功時は lastSeenAt を間引いて更新し、残り期間が短ければ有効期限を延長する（extendExpiry: false で延長しない）。
 */
export async function authenticateDeviceToken(
  token: string,
  request: DeviceRequestInfo,
  options: AuthenticateDeviceOptions = {},
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

  const tokenExpiresAt = await touchDevice(row.id, {
    tokenHash: row.tokenHash as string,
    lastSeenAt: row.lastSeenAt,
    tokenExpiresAt: row.tokenExpiresAt,
    maxAgeDays: resolveTokenMaxAgeDays(parsed.definition),
    extendExpiry: options.extendExpiry ?? true,
    ip: request.ip,
    now,
  });

  return {
    device: { deviceId: row.id, kind: row.kind, label: row.label, scope: parsed.scope },
    tokenExpiresAt,
  };
}

/**
 * lastSeenAt の間引き更新と、有効期限のスライディング延長。更新後の有効期限を返す。
 * 書き込みの失敗・競合（同時の再ペアリング等で token_hash が変わった）では延長しなかった扱いで
 * 元の期限を返し、認証自体は失敗させない（fail-soft。次のアクセスで再試行される）。
 */
async function touchDevice(
  deviceId: string,
  state: {
    tokenHash: string;
    lastSeenAt: Date | null;
    tokenExpiresAt: Date;
    maxAgeDays: number;
    extendExpiry: boolean;
    ip: string | null;
    now: Date;
  },
): Promise<Date> {
  const { now } = state;
  const throttleMs = PAIRED_DEVICE_CONFIG.lastSeenThrottleSeconds * 1000;
  const shouldTouch = !state.lastSeenAt || state.lastSeenAt.getTime() + throttleMs <= now.getTime();
  const refreshThresholdMs = resolveRefreshThresholdDays(state.maxAgeDays) * DAY_MS;
  const shouldExtend =
    state.extendExpiry && state.tokenExpiresAt.getTime() - now.getTime() < refreshThresholdMs;
  if (!shouldTouch && !shouldExtend) return state.tokenExpiresAt;

  const extendedExpiresAt = shouldExtend ? new Date(now.getTime() + state.maxAgeDays * DAY_MS) : null;

  try {
    // 同時アクセスで何度も書かないよう、条件付きで更新する。
    // token_hash 一致を条件に入れ、直前に再ペアリング・失効されたトークンの期限を延ばさない
    const throttleBoundary = new Date(now.getTime() - throttleMs);
    const updated = await db
      .update(PairedDeviceTable)
      .set({
        lastSeenAt: now,
        lastSeenIp: state.ip,
        ...(extendedExpiresAt ? { tokenExpiresAt: extendedExpiresAt } : {}),
      })
      .where(
        and(
          eq(PairedDeviceTable.id, deviceId),
          eq(PairedDeviceTable.tokenHash, state.tokenHash),
          isNull(PairedDeviceTable.revokedAt),
          extendedExpiresAt
            ? sql`true`
            : or(
                isNull(PairedDeviceTable.lastSeenAt),
                lt(PairedDeviceTable.lastSeenAt, throttleBoundary),
              ),
        ),
      )
      .returning({ id: PairedDeviceTable.id });
    if (extendedExpiresAt && updated.length > 0) return extendedExpiresAt;
  } catch (error) {
    console.warn("[pairedDevice] failed to update last seen:", error);
  }
  return state.tokenExpiresAt;
}

/** 端末のトークンを無効にする（失効・再ペアリング前のリセット用）。tx 内で呼ぶ */
export async function clearDeviceToken(deviceId: string, tx: DbTransaction): Promise<void> {
  await tx
    .update(PairedDeviceTable)
    .set({ tokenHash: null, tokenExpiresAt: null, updatedAt: new Date() })
    .where(eq(PairedDeviceTable.id, deviceId));
}
