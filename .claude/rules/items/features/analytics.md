---
paths:
  - "src/features/core/analytics/**"
  - "src/config/features/analytics.config.ts"
---
# features/analytics
what: read-only aggregation over other domains (services, admin API /api/admin/analytics/**, DAU, daily rollups); no admin page upstream, forks build screens
use: analytics (also paymentAnalytics, walletAnalytics, messagingAnalytics)
change: add → rollupMetrics / coinIssuanceSources / exclusionProviders (extensionPoints.ts) | placement → src/config/features/analytics.config.ts
rules:
using:
- db_side_aggregation: aggregate in SQL GROUP BY, never fetch rows and sum in JS (aggregation.ts: changeRate only)
- cache_key: a withAnalyticsCache key has every result-changing param
- rollup_choice: rollup = full-history scans, long series | light GROUP BY → cache first
- rollup_off: switch a metric off by `enabled`, never compute returning [] (screens stop calling it too)
- rollup_exclusion: a metric's compute applies exclusions itself
- coin_source_enabled: a coin source reading a closable feature sets `enabled`
- coin_source_no_double: no source per grant table (a subset of wallet_bonus_grant: double count)
- coin_source_abs: aggregate() returns absolute values
- grant_reason: counted grants write reasonKey or reasonCategory
- exclusion_satellite: row exclusions = a fork satellite table by row id, never a column / index on a core table
- balance_series: balance series → getWalletBalanceSeries, never copy its SQL
editing:
- builtin_no_cache: built-in APIs stay outside withAnalyticsCache
- gate_assert: exported purchase / wallet aggregators start with gate.assert("payment" | "wallet")
- no_default_buckets: no upstream default boundaries / DAU bands (callers pass them)
read: query params, DAU, wallet axes → API | add a service → Usage | cache, user filter → Internals | rollups → src/features/core/analytics/rollupMetrics/README.md Usage | coin issuance → src/features/core/analytics/services/server/coinIssuance/README.md Usage | exclusions, messaging → Related
