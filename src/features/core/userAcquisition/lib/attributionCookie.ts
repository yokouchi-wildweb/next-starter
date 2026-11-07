// src/features/core/userAcquisition/lib/attributionCookie.ts
//
// タッチ履歴 cookie の読み書きロジック（edge-safe）。
//
// proxy（蓄積側）と /api/auth/register（確定保存側）の両方から import されるため、
// このファイルは drizzle / postgres 等のサーバー専用モジュールを import しないこと
// （edge runtime バンドルに含まれる）。
// 訪問の分類（URL・リファラー → タッチ）は ./classifyVisit.ts の classifyVisit。

import { ACQUISITION_CONFIG } from "@/config/app/acquisition.config";
import {
  ACQUISITION_COOKIE_MAX_BYTES,
  ACQUISITION_COOKIE_VERSION,
} from "@/features/core/userAcquisition/constants";
import {
  AttributionCookiePayloadSchema,
  type AttributionCookieTouch,
} from "@/features/core/userAcquisition/entities/schema";
import type { AcquisitionTouch } from "@/features/core/userAcquisition/entities/model";

/**
 * cookie 生値からタッチ配列を復元する。
 * 破損・バージョン不一致・改ざんによるスキーマ違反は黙って読み捨てる
 * （解析用データのため、失敗がユーザー体験に影響してはならない）。
 */
export function parseAttributionCookie(rawValue: string | undefined): AttributionCookieTouch[] {
  if (!rawValue) return [];

  try {
    const parsed = AttributionCookiePayloadSchema.safeParse(JSON.parse(rawValue));
    if (!parsed.success) return [];
    if (parsed.data.v !== ACQUISITION_COOKIE_VERSION) return [];
    return parsed.data.ts;
  } catch {
    return [];
  }
}

/**
 * タッチ配列を cookie 値へシリアライズする。
 * サイズ上限を超える場合は first-touch（先頭）を保持したまま
 * 古い中間タッチ（index 1）から間引く。
 */
export function serializeAttributionCookie(touches: AttributionCookieTouch[]): string {
  const trimmed = [...touches];

  let value = JSON.stringify({ v: ACQUISITION_COOKIE_VERSION, ts: trimmed });
  while (byteLength(value) > ACQUISITION_COOKIE_MAX_BYTES && trimmed.length > 2) {
    trimmed.splice(1, 1);
    value = JSON.stringify({ v: ACQUISITION_COOKIE_VERSION, ts: trimmed });
  }

  return value;
}

/**
 * タッチを履歴へ追記する。
 * - 直前タッチと source / medium / campaign / referrer_host が同一なら追記しない（重複抑止）
 * - maxTouches 超過時は first-touch を保持して古い中間タッチから間引く
 *
 * @returns 追記後の配列。追記不要（重複）の場合は null
 */
export function appendTouch(
  touches: AttributionCookieTouch[],
  touch: AttributionCookieTouch,
): AttributionCookieTouch[] | null {
  const last = touches[touches.length - 1];
  if (last && isSameChannel(last, touch)) return null;

  const next = [...touches, touch];
  while (next.length > ACQUISITION_CONFIG.maxTouches) {
    next.splice(1, 1);
  }

  return next;
}

/**
 * cookie 上の圧縮表現をドメイン内部の正規化表現へ復元する。
 */
export function toAcquisitionTouch(touch: AttributionCookieTouch): AcquisitionTouch {
  return {
    occurredAt: new Date(touch.t * 1000),
    utmSource: touch.s ?? null,
    utmMedium: touch.m ?? null,
    utmCampaign: touch.c ?? null,
    referrerHost: touch.r ?? null,
    landingPage: touch.l ?? null,
    extras: touch.x ?? null,
  };
}

/**
 * GA の `_ga` cookie 値から client_id を取り出す（GA データとの突合用）。
 * 形式: "GA1.1.123456789.1700000000" → client_id は末尾 2 セグメント
 * "123456789.1700000000"。形式不明なら null。
 */
export function extractGaClientId(rawValue: string | undefined): string | null {
  if (!rawValue) return null;

  const segments = rawValue.split(".");
  if (segments.length < 4) return null;

  const clientId = segments.slice(-2).join(".");
  return /^\d+\.\d+$/.test(clientId) ? clientId : null;
}

// ─────────────────────────────────────────────────────────────────────────────
// ヘルパー関数
// ─────────────────────────────────────────────────────────────────────────────

/**
 * 同一チャンネルからの連続流入か（重複追記の抑止判定）。
 * occurredAt や extras の差異は無視し、集計軸のみを比較する。
 */
function isSameChannel(a: AttributionCookieTouch, b: AttributionCookieTouch): boolean {
  return a.s === b.s && a.m === b.m && a.c === b.c && a.r === b.r;
}

function byteLength(value: string): number {
  return new TextEncoder().encode(value).length;
}
