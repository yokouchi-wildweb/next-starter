// src/features/core/userAcquisition/lib/attributionCookie.ts
//
// タッチ履歴 cookie の読み書きロジック（edge-safe）。
//
// proxy（蓄積側）と /api/auth/register（確定保存側）の両方から import されるため、
// このファイルは drizzle / postgres 等のサーバー専用モジュールを import しないこと
// （edge runtime バンドルに含まれる）。

import { ACQUISITION_CONFIG } from "@/config/app/acquisition.config";
import {
  ACQUISITION_COOKIE_MAX_BYTES,
  ACQUISITION_COOKIE_VERSION,
  REFERRAL_MEDIUM,
} from "@/features/core/userAcquisition/constants";
import {
  AttributionCookiePayloadSchema,
  type AttributionCookieTouch,
} from "@/features/core/userAcquisition/entities/schema";
import type { AcquisitionTouch } from "@/features/core/userAcquisition/entities/model";

/** UTM のうち集計軸として型付きカラムに昇格させるパラメータ */
const UTM_PRIMARY_PARAMS = ["utm_source", "utm_medium", "utm_campaign"] as const;
/** UTM のうち extras(jsonb) に保存するロングテールパラメータ */
const UTM_EXTRA_PARAMS = ["utm_term", "utm_content"] as const;

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

export type NavigationSignal = {
  /** リクエスト URL（クエリパラメータ含む） */
  url: URL;
  /** Referer ヘッダー生値（無ければ null） */
  referrer: string | null;
  /** タッチ発生日時 */
  now: Date;
};

/**
 * ナビゲーションリクエストから流入タッチを導出する。
 *
 * タッチとみなす条件（いずれか）:
 * - utm_* パラメータがある
 * - 既知の広告クリック ID パラメータがある
 * - 外部リファラーがある（自ホストからの遷移は対象外）
 *
 * タッチ条件（いずれか）:
 * - utm_* パラメータがある
 * - 既知の広告クリック ID パラメータがある
 * - 招待リンクパラメータ（referralParam）がある
 * - 外部リファラーがある（自ホストからの遷移は対象外）
 *
 * source / medium の補完は GA の慣例に準拠（優先順位: UTM > クリック ID > 招待リンク > リファラー）:
 * UTM 無し + クリック ID → クリック ID 由来の source/medium、
 * UTM 無し + 招待リンク → referralParam の source/medium（medium は "referral" と別語彙）、
 * UTM 無し + 外部リファラーのみ → source=リファラーホスト, medium="referral"
 *
 * @returns タッチ。流入シグナルが無い場合は null
 */
export function buildTouchFromNavigation(signal: NavigationSignal): AttributionCookieTouch | null {
  const params = signal.url.searchParams;

  const utmSource = readParam(params, "utm_source");
  const utmMedium = readParam(params, "utm_medium");
  const utmCampaign = readParam(params, "utm_campaign");

  const extras: Record<string, string> = {};
  for (const key of UTM_EXTRA_PARAMS) {
    const value = readParam(params, key);
    if (value) extras[key] = value;
  }

  let clickIdChannel: { source: string; medium: string } | null = null;
  let hasClickId = false;
  for (const [param, channel] of Object.entries(ACQUISITION_CONFIG.clickIdParams)) {
    const value = readParam(params, param);
    if (!value) continue;
    extras[param] = value;
    hasClickId = true;
    clickIdChannel ??= channel;
  }

  // 招待リンク（紹介リワード）。コードは extras に保存し、本登録時の自動適用にも使う
  const inviteCode = readParam(params, ACQUISITION_CONFIG.referralParam.param);
  if (inviteCode) extras[ACQUISITION_CONFIG.referralParam.param] = inviteCode;

  const referrerHost = resolveExternalReferrerHost(signal.referrer, signal.url.host);

  const hasUtm = Boolean(utmSource || utmMedium || utmCampaign);
  if (!hasUtm && !hasClickId && !inviteCode && !referrerHost) return null;

  // source / medium の補完（UTM 明示指定が常に優先）
  let source = utmSource;
  let medium = utmMedium;
  if (!source && clickIdChannel) {
    source = clickIdChannel.source;
    medium ??= clickIdChannel.medium;
  }
  if (!source && inviteCode) {
    source = ACQUISITION_CONFIG.referralParam.source;
    medium ??= ACQUISITION_CONFIG.referralParam.medium;
  }
  if (!source && referrerHost) {
    source = referrerHost;
    medium ??= REFERRAL_MEDIUM;
  }

  return {
    t: Math.floor(signal.now.getTime() / 1000),
    ...(source ? { s: source } : {}),
    ...(medium ? { m: medium } : {}),
    ...(utmCampaign ? { c: utmCampaign } : {}),
    ...(referrerHost ? { r: referrerHost } : {}),
    l: signal.url.pathname,
    ...(Object.keys(extras).length > 0 ? { x: extras } : {}),
  };
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

function readParam(params: URLSearchParams, key: string): string | null {
  const value = params.get(key)?.trim();
  if (!value) return null;
  // cookie 肥大と異常値の DB 流入を防ぐため個別値も切り詰める
  return value.slice(0, 200);
}

/**
 * Referer ヘッダーから外部リファラーのホストを取り出す。
 * 自ホスト（サイト内遷移）や不正な URL は null。
 */
function resolveExternalReferrerHost(referrer: string | null, ownHost: string): string | null {
  if (!referrer) return null;

  try {
    const host = new URL(referrer).host;
    if (!host || host === ownHost) return null;
    return host.slice(0, 255);
  } catch {
    return null;
  }
}

function byteLength(value: string): number {
  return new TextEncoder().encode(value).length;
}
