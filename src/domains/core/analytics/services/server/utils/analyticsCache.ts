// src/domains/core/analytics/services/server/utils/analyticsCache.ts
// 集計読み取り用のサーバーサイドのレスポンスキャッシュ(公開の入口は ../analyticsCache.ts)。
//
// 設計方針:
//  - 置き場は共有のキャッシュの標準("use cache: remote" + 札、@/lib/cacheTags の defineSharedRead)。
//    全インスタンスで 1 つの値を共有し、invalidateAnalyticsCache の札で全インスタンスから消える。
//    置き場が止まった時は readThrough で集計を直に計算する(生成した読みと同じ落ち方)。
//  - 「確定済み範囲(過去日のみ)は長い寿命、当日を含む範囲は短い寿命」を ResolvedDateRange から導く。
//    判定の TZ は dateRange.ts のバケットキー(formatDateKeyTz)をそのまま使い、境界ズレを防ぐ。
//  - 確定済みでも immutable にはしない。バックフィル・ロールアップの再計算・集計の除外の遡及適用で
//    過去バケットの値は書き換わるため、「有限の寿命 + 札で消す」で運用する。
//  - Next の "use cache" は関数を引数で受け取れない(pass-through だけ)ので、集計は名前を付けて定義する
//    (withAnalyticsCache(name, compute) が読みを返す)。鍵 = 名前 + 引数(range を含む)。
//
// 無効化: 環境変数 ANALYTICS_CACHE=disabled で全キャッシュが素通しになる
// (AUDIT_MODE=disabled と同様のエスケープハッチ)。

import { cacheTagOf, defineSharedRead, markCacheTags } from "@/lib/cacheTags/server";
import {
  DEFAULT_ANALYTICS_CACHE_CLOSED_SECONDS,
  DEFAULT_ANALYTICS_CACHE_LIVE_SECONDS,
  MAX_ANALYTICS_CACHE_CLOSED_SECONDS,
  MAX_ANALYTICS_CACHE_LIVE_SECONDS,
} from "@/domains/core/analytics/constants";
import type { ResolvedDateRange } from "@/domains/core/analytics/types/common";
import { formatDateKeyTz } from "./dateRange";

// ============================================================================
// 公開 API
// ============================================================================

/** 札のドメイン名(全集計の札 "analytics"、読みごとの札 "analytics:<name>") */
const ANALYTICS_TAG_DOMAIN = "analytics";

export type AnalyticsCacheOptions = {
  /** 確定済み範囲の寿命(秒)。既定: DEFAULT_ANALYTICS_CACHE_CLOSED_SECONDS(12 時間)、上限 30 日 */
  closedSeconds?: number;
  /** 当日を含む範囲の寿命(秒)。既定: DEFAULT_ANALYTICS_CACHE_LIVE_SECONDS(1 分)、上限 1 時間 */
  liveSeconds?: number;
};

/**
 * 集計 compute を名前 name で定義し、共有のキャッシュで覚える読み `(range, ...args) => Promise<T>` を返す。
 * モジュールの頭(関数の外)で 1 回だけ呼ぶ。
 *
 * - name: 集計ごとに 1 つ(安定した文字列。例 "walletHistory.summary")。札 "analytics:<name>" と鍵の一部になる
 * - range と args が鍵: 結果を変える引数を全部 args に入れる(閉じ込めた値は鍵に入らない)。
 *   range と args・戻り値は直列化できる値だけ(素のオブジェクト・配列・Date。クラスのインスタンス・関数は不可)
 * - 戻り値・例外は compute と同じ(例外は覚えない)
 * - 同時の取りこぼしはそれぞれ計算する(インスタンスの中の相乗りは無い)
 *
 * 使用例:
 *   const summary = withAnalyticsCache("walletHistory.summary", (range, walletType: string) => computeSummary(range, walletType));
 *   return summary(range, walletType ?? "");
 */
export function withAnalyticsCache<A extends unknown[], T>(
  name: string,
  compute: (range: ResolvedDateRange, ...args: A) => Promise<T>,
  options: AnalyticsCacheOptions = {},
): (range: ResolvedDateRange, ...args: A) => Promise<T> {
  const nameTag = cacheTagOf(ANALYTICS_TAG_DOMAIN, name);
  const closedSeconds = lifeSeconds("closedSeconds", options.closedSeconds, DEFAULT_ANALYTICS_CACHE_CLOSED_SECONDS, MAX_ANALYTICS_CACHE_CLOSED_SECONDS);
  const liveSeconds = lifeSeconds("liveSeconds", options.liveSeconds, DEFAULT_ANALYTICS_CACHE_LIVE_SECONDS, MAX_ANALYTICS_CACHE_LIVE_SECONDS);
  const tags = [cacheTagOf(ANALYTICS_TAG_DOMAIN), nameTag];
  const read = defineSharedRead(`analytics.${name}`, compute);

  return (range, ...args) => {
    if (isCacheDisabled()) return compute(range, ...args);
    const seconds = isClosedRange(range) ? closedSeconds : liveSeconds;
    return read({ life: { revalidate: seconds, expire: seconds }, tags }, range, ...args);
  };
}

/**
 * 範囲が「確定済み(過去日のみで構成され、以後自然には変化しない)」かを判定する。
 *
 * range.timezone 上の日付キー比較で dateTo が今日より前なら確定済み。
 * hour 粒度で当日の過去時間帯を含む場合も「当日を含む」扱い(短い寿命の側)になる。
 */
export function isClosedRange(range: ResolvedDateRange): boolean {
  const tz = range.timezone;
  return formatDateKeyTz(range.dateTo, tz) < formatDateKeyTz(new Date(), tz);
}

/**
 * 覚えた集計を消す札を積む(全インスタンスから消える)。
 *
 * @param name 指定時はその名前の集計だけ(札 "analytics:<name>")。省略時は全集計(札 "analytics")。
 *
 * 用途: ロールアップの再計算・バックフィル・集計の除外の遡及適用など、確定済みバケットの値を書き換えた直後に呼ぶ。
 * 消すのは入口(routeFactory・cron の route)が要求の終わりに 1 回(@/lib/cacheTags)。
 * 入口の外(pnpm task のバックフィル等)では消せず記録の 1 行になり、確定済みの寿命(既定 12 時間)で切れる。
 */
export function invalidateAnalyticsCache(name?: string): void {
  markCacheTags(name === undefined ? cacheTagOf(ANALYTICS_TAG_DOMAIN) : cacheTagOf(ANALYTICS_TAG_DOMAIN, name));
}

// ============================================================================
// 内部実装
// ============================================================================

function isCacheDisabled(): boolean {
  return process.env.ANALYTICS_CACHE === "disabled";
}

/** 寿命の秒を決める(正の整数、上限まで)。定義の時に投げる */
function lifeSeconds(key: string, value: number | undefined, fallback: number, max: number): number {
  if (value === undefined) return fallback;
  if (!Number.isInteger(value) || value <= 0 || value > max) {
    throw new Error(`withAnalyticsCache: ${key} は 1〜${max} の整数(秒)にしてください(今: ${value})`);
  }
  return value;
}
