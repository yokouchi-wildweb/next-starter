// src/domains/core/analytics/services/server/analyticsCache.ts
// 集計のレスポンスキャッシュの公開の入口(本体は utils/analyticsCache.ts)。他のドメインはここから読む。
// - withAnalyticsCache(name, compute, options?): 集計を名前で定義し、共有のキャッシュ("use cache: remote")で覚える読みを返す
//   (確定済み範囲は 12 時間、当日を含む範囲は 1 分。全インスタンスで共有、置き場が止まったら直に計算する)
// - invalidateAnalyticsCache(name?): 確定済みの集計を書き換えた直後に札を積む(ロールアップの再計算・バックフィル・
//   集計の除外の条件(plugs/analyticsExclusionProviders の fork の表)を足す・外す・遡及適用した時)。
//   入口(routeFactory・cron の route)が要求の終わりに全インスタンスから消す。入口の外(pnpm task)は記録の 1 行で、寿命で切れる

export { invalidateAnalyticsCache, withAnalyticsCache } from "./utils/analyticsCache";
export type { AnalyticsCacheOptions } from "./utils/analyticsCache";
