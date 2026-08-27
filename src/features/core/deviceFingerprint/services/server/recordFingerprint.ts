// src/features/core/deviceFingerprint/services/server/recordFingerprint.ts

import { createHash } from "node:crypto";

import { sql } from "drizzle-orm";

import { db } from "@/lib/drizzle";
import { getAuditContext } from "@/lib/audit";
import { DomainError } from "@/lib/errors";
import type { DbTransaction } from "@/lib/crud/drizzle/types";
import { stableStringify } from "@/lib/fingerprint/hash";
import { FINGERPRINT_CONFIG } from "@/config/app/fingerprint.config";

import { DeviceFingerprintTable } from "@/features/core/deviceFingerprint/entities/drizzle";
import {
  DeviceFingerprintIngestSchema,
  type DeviceFingerprintIngestInput,
} from "@/features/core/deviceFingerprint/entities/schema";
import type { DeviceFingerprint } from "@/features/core/deviceFingerprint/entities/model";
import {
  DEFAULT_DEVICE_FINGERPRINT_RETENTION_DAYS,
  type DeviceFingerprintSource,
} from "@/features/core/deviceFingerprint/constants";

export type RecordDeviceFingerprintInput = {
  userId: string;
  source: DeviceFingerprintSource;
  /** クライアントから受領した ingest payload (Zod 検証はこの関数内で行う) */
  payload: unknown;
  /** 省略時は ALS context (getAuditContext().ip) からフォールバック取得する */
  ip?: string | null;
  /** 省略時は ALS context からフォールバック取得する。明示 null で「記録しない」 */
  userAgent?: string | null;
  /** 省略時は DEFAULT_DEVICE_FINGERPRINT_RETENTION_DAYS */
  retentionDays?: number;
  /** fingerprintChallenge の submit など、外側の tx に同乗させる場合に指定 */
  tx?: DbTransaction;
};

/**
 * デバイスフィンガープリントを device_fingerprints へ upsert する。
 *
 * 設計上の取り決め:
 * - composite_hash はクライアント値を信用せず componentHashes からサーバー側で再計算する
 *   (成分値自体がクライアント申告である事実は変わらない。偽装耐性ではなく整合性のため)。
 * - (user_id, composite_hash) 衝突時は seen_count++ / last_seen_at 更新に畳む。
 *   ip / user_agent は最新値で上書き、raw_signals は初回保存分を維持する。
 * - raw_signals が config の maxRawSignalsBytes を超える場合は null に落とす
 *   (検索軸のハッシュ列は常に保存される)。
 * - config の有効 / 無効はここでは判定しない。ゲートは呼び出し側
 *   (page ingest ルート = collection.enabled / challenge submit = challenge.enabled)。
 *
 * @returns upsert された行。入力不正は DomainError(400) を throw する
 *   (bestEffort にしたい呼び出し側で catch する)
 */
export async function recordDeviceFingerprint(
  input: RecordDeviceFingerprintInput,
): Promise<DeviceFingerprint> {
  const parsed = DeviceFingerprintIngestSchema.safeParse(input.payload);
  if (!parsed.success) {
    throw new DomainError("フィンガープリントの形式が不正です", { status: 400 });
  }
  const payload: DeviceFingerprintIngestInput = parsed.data;
  const { componentHashes } = payload;

  const compositeHash = createHash("sha256")
    .update(stableStringify(componentHashes))
    .digest("hex");

  const alsContext = getAuditContext();
  const ip = (input.ip ?? alsContext?.ip ?? "").trim() || null;
  const userAgent =
    input.userAgent !== undefined ? input.userAgent : alsContext?.userAgent ?? null;

  const rawSignals =
    payload.rawSignals !== undefined &&
    JSON.stringify(payload.rawSignals).length <= FINGERPRINT_CONFIG.collection.maxRawSignalsBytes
      ? payload.rawSignals
      : null;

  const executor = input.tx ?? db;
  const rows = await executor
    .insert(DeviceFingerprintTable)
    .values({
      userId: input.userId,
      source: input.source,
      compositeHash,
      canvasHash: componentHashes.canvas,
      webglHash: componentHashes.webgl,
      audioHash: componentHashes.audio,
      fontsHash: componentHashes.fonts,
      screenKey: componentHashes.screen,
      timezone: componentHashes.timezone,
      languages: componentHashes.languages,
      platform: componentHashes.platform,
      hardwareKey: componentHashes.hardware,
      webglRenderer: payload.webglRenderer ?? null,
      componentHashes,
      rawSignals,
      ip,
      userAgent,
      retentionDays: input.retentionDays ?? DEFAULT_DEVICE_FINGERPRINT_RETENTION_DAYS,
    })
    .onConflictDoUpdate({
      target: [DeviceFingerprintTable.userId, DeviceFingerprintTable.compositeHash],
      set: {
        seenCount: sql`${DeviceFingerprintTable.seenCount} + 1`,
        lastSeenAt: sql`NOW()`,
        // 直近の観測環境を反映する (raw_signals は初回保存分を維持)
        source: input.source,
        ip,
        userAgent,
      },
    })
    .returning();

  return rows[0] as unknown as DeviceFingerprint;
}
