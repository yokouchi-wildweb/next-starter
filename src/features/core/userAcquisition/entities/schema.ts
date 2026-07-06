// src/features/core/userAcquisition/entities/schema.ts

import { z } from "zod";

/**
 * cookie 内の 1 タッチ（圧縮表現）。
 * cookie 4KB 制限のためキーを 1 文字に短縮している:
 * t=occurredAt(epoch秒) / s=utm_source / m=utm_medium / c=utm_campaign
 * / r=referrer_host / l=landing_page / x=extras
 *
 * cookie はクライアント改ざんが可能なため、各フィールドに長さ上限を設けて
 * 異常値の DB 流入を防ぐ（値の真正性までは保証しない = 解析用データとして許容）。
 */
export const AttributionCookieTouchSchema = z.object({
  t: z.number().int().nonnegative(),
  s: z.string().min(1).max(200).optional(),
  m: z.string().min(1).max(200).optional(),
  c: z.string().min(1).max(200).optional(),
  r: z.string().min(1).max(255).optional(),
  l: z.string().min(1).max(500).optional(),
  x: z.record(z.string().max(64), z.string().max(500)).optional(),
});

export type AttributionCookieTouch = z.infer<typeof AttributionCookieTouchSchema>;

/**
 * cookie ペイロード全体。v が現行バージョンと不一致の場合は読み捨てる。
 */
export const AttributionCookiePayloadSchema = z.object({
  v: z.number().int(),
  ts: z.array(AttributionCookieTouchSchema).max(50),
});

export type AttributionCookiePayload = z.infer<typeof AttributionCookiePayloadSchema>;
