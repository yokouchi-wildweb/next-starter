// src/features/core/userAcquisition/lib/classifyVisit.ts
//
// 流入経路の公開の口(edge-safe)。判別表と分類はこのドメインが持ち、外(proxy・本登録の route・
// src/wiring 経由の lib/googleTag)はここの関数だけを使う。acquisition.config.ts を読むのはこのドメインの中だけ。
//
// proxy(蓄積側)・/api/auth/register(確定保存側)・root layout(GA4 へ判別表を渡す)から import されるため、
// このファイルは drizzle / postgres 等のサーバー専用モジュールを import しないこと。

import { ACQUISITION_CONFIG } from "@/config/app/acquisition.config";
import { REFERRAL_MEDIUM } from "@/features/core/userAcquisition/constants";
import type { AttributionCookieTouch } from "@/features/core/userAcquisition/entities/schema";
import { channels } from "@/features/core/userAcquisition/extensions/channels";
import type {
  AcquisitionChannel,
  AcquisitionChannelDefinition,
} from "@/features/core/userAcquisition/types/channel";

/** UTM のうち集計軸として型付きカラムに昇格させるパラメータ */
const UTM_PRIMARY_PARAMS = ["utm_source", "utm_medium", "utm_campaign"] as const;
/** UTM のうち extras(jsonb) に保存するロングテールパラメータ */
const UTM_EXTRA_PARAMS = ["utm_term", "utm_content"] as const;

/**
 * 流入経路の記録の opt-in(既定 false)。閉じる値(門番の規則 userAcquisition)とは別(L1.8):
 * 呼ぶ側が `gate.enabled("userAcquisition") && isAcquisitionRecordingEnabled()` と両方を確かめる
 * (依存の検査は読む側のファイルの gate.enabled の字面を見る)。cookie の蓄積(proxy)と本登録の確定保存(register)は
 * どちらかが閉の間は何もしない。
 */
export function isAcquisitionRecordingEnabled(): boolean {
  return ACQUISITION_CONFIG.enabled;
}

/**
 * タッチ履歴 cookie の maxAge(秒)。追記のたびにリフレッシュする = 最終タッチからこの期間有効。
 */
export function getAttributionCookieMaxAgeSeconds(): number {
  return ACQUISITION_CONFIG.cookieMaxAgeDays * 24 * 60 * 60;
}

/**
 * 判別表(シリアライズできる値)。並び = 優先順位: clickId の行が先、link の行が後、
 * 同じ種類の中は表の順(clickId = config の clickIdParams の順 → 受け口の項目のファイル名の順)。
 * 受け口 channels/ の項目は、持ち主の機能が閉じている間(enabled() が false)出さない。
 * 同じ param が config と項目の両方にあれば例外(どちらが勝つかを黙って決めない)。
 */
export function getChannelDefinitions(): AcquisitionChannelDefinition[] {
  const rows: AcquisitionChannelDefinition[] = Object.entries(ACQUISITION_CONFIG.clickIdParams).map(
    ([param, channel]) => ({ param, kind: "clickId", channel: channel ? { ...channel } : null }),
  );
  for (const item of Object.values(channels)) {
    if (item.enabled && !item.enabled()) continue;
    if (rows.some((row) => row.param === item.param)) {
      throw new Error(`userAcquisition channels: param "${item.param}" が clickIdParams と重複している`);
    }
    rows.push({ param: item.param, kind: item.kind, channel: item.channel ? { ...item.channel } : null });
  }
  return [
    ...rows.filter((row) => row.kind === "clickId"),
    ...rows.filter((row) => row.kind === "link"),
  ];
}

export type VisitSignal = {
  /** リクエスト URL（クエリパラメータ含む） */
  url: URL;
  /** Referer ヘッダー生値（無ければ null） */
  referrer: string | null;
  /** タッチ発生日時 */
  now: Date;
};

/**
 * ナビゲーションリクエストを分類し、流入タッチ(cookie の圧縮表現)を返す。
 *
 * タッチ条件（いずれか）: utm_* パラメータ / 判別表の行のパラメータ / 外部リファラー（自ホストからの遷移は対象外）
 *
 * source / medium の補完は GA の慣例に準拠（優先順位: UTM > clickId の行 > link の行 > リファラー）:
 * - UTM の source が無ければ、値のある行のうち表の先の行の channel で source を補い、medium は UTM に無いときだけ補う
 * - 行が無く外部リファラーだけ → source=リファラーホスト, medium="referral"
 * - 値のある行のパラメータは extras[param] に保存する（channel が null の行も）
 *
 * @param definitions 判別表（省略 = getChannelDefinitions()）
 * @returns タッチ。流入シグナルが無い場合は null
 */
export function classifyVisit(
  signal: VisitSignal,
  definitions: AcquisitionChannelDefinition[] = getChannelDefinitions(),
): AttributionCookieTouch | null {
  const params = signal.url.searchParams;

  const [utmSource, utmMedium, utmCampaign] = UTM_PRIMARY_PARAMS.map((key) => readParam(params, key));

  const extras: Record<string, string> = {};
  for (const key of UTM_EXTRA_PARAMS) {
    const value = readParam(params, key);
    if (value) extras[key] = value;
  }

  let hasRow = false;
  let clickIdChannel: AcquisitionChannel | null = null;
  let linkChannel: AcquisitionChannel | null = null;
  for (const row of definitions) {
    const value = readParam(params, row.param);
    if (!value) continue;
    extras[row.param] = value;
    hasRow = true;
    if (row.kind === "clickId") clickIdChannel ??= row.channel;
    else linkChannel ??= row.channel;
  }

  const referrerHost = resolveExternalReferrerHost(signal.referrer, signal.url.host);

  const hasUtm = Boolean(utmSource || utmMedium || utmCampaign);
  if (!hasUtm && !hasRow && !referrerHost) return null;

  // source / medium の補完（UTM 明示指定が常に優先）
  let source = utmSource;
  let medium = utmMedium;
  for (const channel of [clickIdChannel, linkChannel]) {
    if (!source && channel) {
      source = channel.source;
      medium ??= channel.medium;
    }
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
