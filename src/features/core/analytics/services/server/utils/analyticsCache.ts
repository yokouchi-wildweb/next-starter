// src/features/core/analytics/services/server/utils/analyticsCache.ts
// 集計読み取り用のサーバーサイドレスポンスキャッシュ。
//
// 設計方針:
//  - 「確定済み範囲（過去日のみ）は長期TTL、当日を含む範囲は短TTL」の判定を
//    ResolvedDateRange から自動導出する。判定のTZロジックは dateRange.ts の
//    バケットキー生成（formatDateKeyTz）をそのまま再利用し、境界ズレを防ぐ。
//  - 確定済み範囲でも immutable にはしない。バックフィル・ロールアップ再計算・
//    集計除外の遡及適用で過去バケットの値は書き換わり得るため、
//    「長期だが有限のTTL + 明示的な invalidateAnalyticsCache()」で運用する。
//  - キャッシュ本体はインスタンス内メモリLRU。サーバーレスの複数インスタンス間で
//    共有されないことは許容する（各インスタンスが独立にウォームアップする）。
//  - 同一キーの計算が同時多発した場合は in-flight の Promise を共有し、
//    重複計算を1回に抑える（ダッシュボードの並列リクエスト対策）。
//
// 無効化: 環境変数 ANALYTICS_CACHE=disabled で全キャッシュが素通しになる
// （AUDIT_MODE=disabled と同様のエスケープハッチ）。

import {
  ANALYTICS_CACHE_MAX_ENTRIES,
  DEFAULT_ANALYTICS_CACHE_TTL_CLOSED_MS,
  DEFAULT_ANALYTICS_CACHE_TTL_LIVE_MS,
} from "@/features/core/analytics/constants";
import type { ResolvedDateRange } from "@/features/core/analytics/types/common";
import { formatDateKeyTz } from "./dateRange";

// ============================================================================
// 公開 API
// ============================================================================

export type AnalyticsCacheOptions = {
  /**
   * キャッシュキー。クエリ結果に影響する全パラメータ（メトリクス名・フィルタ等）を
   * 呼び出し側で必ず含めること。range（期間・TZ・粒度）は自動でキーに合成される。
   *
   * 配列を渡した場合は各要素をシリアライズして連結する。
   * 先頭要素を「メトリクス名などの安定した文字列」にしておくと
   * invalidateAnalyticsCache(prefix) でのプレフィックス無効化が使いやすい。
   */
  key: string | readonly unknown[];
  /** 対象の解決済み日付範囲。確定/当日判定とキー合成に使用する */
  range: ResolvedDateRange;
  /** 当日を含む範囲のTTL（ms）。既定: DEFAULT_ANALYTICS_CACHE_TTL_LIVE_MS */
  ttlLiveMs?: number;
  /** 確定済み範囲のTTL（ms）。既定: DEFAULT_ANALYTICS_CACHE_TTL_CLOSED_MS */
  ttlClosedMs?: number;
};

/**
 * 集計処理をレスポンスキャッシュ付きで実行する透過ラッパー。
 *
 * 戻り値・例外はラップ対象と同一（例外はキャッシュしない）。
 *
 * 使用例:
 *   return withAnalyticsCache(
 *     { key: ["walletHistory.summary", walletType ?? ""], range },
 *     () => computeSummary(range, walletType),
 *   );
 */
export async function withAnalyticsCache<T>(
  opts: AnalyticsCacheOptions,
  fn: () => Promise<T>,
): Promise<T> {
  if (isCacheDisabled()) {
    return fn();
  }

  const callerKey = serializeCallerKey(opts.key);
  const cacheKey = buildCacheKey(callerKey, opts.range);
  const now = Date.now();

  const hit = readEntry(cacheKey, now);
  if (hit) {
    return hit.promise as Promise<T>;
  }

  const ttlMs = isClosedRange(opts.range)
    ? opts.ttlClosedMs ?? DEFAULT_ANALYTICS_CACHE_TTL_CLOSED_MS
    : opts.ttlLiveMs ?? DEFAULT_ANALYTICS_CACHE_TTL_LIVE_MS;

  // in-flight 共有のため Promise 自体を格納する。
  // 失敗時はエントリを破棄してエラーをキャッシュしない。
  const promise = fn();
  writeEntry(cacheKey, { promise, expiresAt: now + ttlMs, callerKey });
  promise.catch(() => {
    // 後続の成功結果を消さないよう、同一 Promise のときだけ破棄する
    if (cache.get(cacheKey)?.promise === promise) {
      cache.delete(cacheKey);
    }
  });

  return promise;
}

/**
 * 範囲が「確定済み（過去日のみで構成され、以後自然には変化しない）」かを判定する。
 *
 * range.timezone 上の日付キー比較で dateTo が今日より前なら確定済み。
 * hour 粒度で当日の過去時間帯を含む場合も「当日を含む」扱い（短TTL側）になる。
 */
export function isClosedRange(range: ResolvedDateRange): boolean {
  const tz = range.timezone;
  return formatDateKeyTz(range.dateTo, tz) < formatDateKeyTz(new Date(), tz);
}

/**
 * キャッシュを無効化する。
 *
 * @param keyPrefix 指定時は「呼び出し側キーがこのプレフィックスで始まる」エントリのみ削除。
 *                  省略時は全削除。
 *
 * 用途: ロールアップ再計算・バックフィル・集計除外の遡及適用など、
 * 確定済みバケットの値を書き換えた直後に呼ぶ（同一インスタンス内のみ有効。
 * 他インスタンスはTTL満了で追随する）。テストのクリーンアップにも使う。
 */
export function invalidateAnalyticsCache(keyPrefix?: string): void {
  if (keyPrefix === undefined) {
    cache.clear();
    return;
  }
  for (const [key, entry] of cache) {
    if (entry.callerKey.startsWith(keyPrefix)) {
      cache.delete(key);
    }
  }
}

// ============================================================================
// 内部実装
// ============================================================================

type CacheEntry = {
  promise: Promise<unknown>;
  expiresAt: number;
  callerKey: string;
};

// モジュールスコープのインスタンス内キャッシュ。
// Map の挿入順を LRU の近似として使う（get 時に再挿入して先頭を最古に保つ）。
const cache = new Map<string, CacheEntry>();

function isCacheDisabled(): boolean {
  return process.env.ANALYTICS_CACHE === "disabled";
}

function serializeCallerKey(key: string | readonly unknown[]): string {
  if (typeof key === "string") return key;
  return key
    .map((part) => (typeof part === "string" ? part : JSON.stringify(part) ?? "undefined"))
    .join("|");
}

function buildCacheKey(callerKey: string, range: ResolvedDateRange): string {
  const rangePart = [
    range.dateFrom.getTime(),
    range.dateTo.getTime(),
    range.timezone,
    range.granularity,
  ].join("|");
  return `${callerKey}::${rangePart}`;
}

function readEntry(cacheKey: string, now: number): CacheEntry | undefined {
  const entry = cache.get(cacheKey);
  if (!entry) return undefined;
  if (entry.expiresAt <= now) {
    cache.delete(cacheKey);
    return undefined;
  }
  // LRU: アクセスされたエントリを末尾へ移動
  cache.delete(cacheKey);
  cache.set(cacheKey, entry);
  return entry;
}

function writeEntry(cacheKey: string, entry: CacheEntry): void {
  if (cache.size >= ANALYTICS_CACHE_MAX_ENTRIES) {
    // 最古（先頭）のエントリを破棄
    const oldest = cache.keys().next().value;
    if (oldest !== undefined) cache.delete(oldest);
  }
  cache.set(cacheKey, entry);
}
