# DOWNSTREAM NOTICE id:20261105-121534-wallet-balance-series
from: git@github.com:yokouchi-wildweb/next-starter.git | branch:main | commit:- (this commit)
date: 2026-11-05T12:15:34+09:00
severity: info
checkpoint: wallet-balance-series
resolves: 20261101-180140-wallet-balance-series-multi-type
change: New public server query getWalletBalanceSeries (src/features/core/analytics/services/server/walletHistoryAnalytics.ts): params = DateRangeParams & UserIdFilter & UserFilter & { walletTypes?: readonly string[] } (omitted/empty = all types, one = that type, several = summed per-(user, type) anchors); returns { dateFrom, dateTo, granularity, walletTypes, history: [{ date, closingBalance }] } with one query (no activity counts). Exclusion: stock scope of the analytics exclusion receptacle unless userId is given; includeExcluded: true turns it off. getWalletBalanceDaily now runs on the same internal functions; its response and values are unchanged (checked on the upstream dev DB: identical output for all / coin / point / weekly).
why: Forks copied getWalletBalanceDaily's balance SQL to get a multi-type series (oripa-do getPrizeExchangeBalanceHistory, copied-from mark) because the upstream query took one walletType, always ran the activity query and had a fixed exclusion rule.
required_actions:
1. None required. Merge upstream up to this checkpoint.
2. If the fork copied the balance series: find it with git grep -n "copied-from: src/features/core/analytics/services/server/walletHistoryAnalytics.ts" -- src . Replace the copied query with a call to getWalletBalanceSeries({ ...dateRange, walletTypes }) and map history to the fork's response; delete the copy. If the copy always excluded users of an applied exclusion, provide that rule as an exclusion provider's stock (notice 20261105-115033-analytics-exclusion-providers) so the series keeps excluding them.
verify: pnpm typecheck | the fork's balance chart shows the same values before and after the switch for the same period and types.
manual_steps: -
refs: src/features/core/analytics/services/server/walletHistoryAnalytics.ts (getWalletBalanceSeries), src/features/core/analytics/README.md (残高の系列), notice 20261105-115033-analytics-exclusion-providers, order 20261101-180140-wallet-balance-series-multi-type
notes: oripa-do's copy resolves walletTypes from a counterId and returns closingBalance only; both map directly onto the new query (resolve the types in the fork, pass walletTypes). Its fixed "exclude users with an applied exclusion" matches the stock scope once the fork has a provider; it differs only for a userId-scoped call (the upstream query skips exclusion then). The new function adds no API route and does not change /api/admin/analytics/wallet-history/balance. Not run in oripa-do.
