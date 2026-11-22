---
paths:
  - "src/domains/core/wallet/**"
  - "src/config/domains/wallet.config.ts"
---
# domains/wallet
what: per-user in-app currencies: balance, reservation, history, expiry lots | entry walletService (services/server/walletService), types @/domains/core/wallet
use: wallet
change: add = a purchase bonus display in <domain>/plugs/walletPurchaseBonuses/ (point walletPurchaseBonuses) | override = <domain>/plugs/walletPurchaseBonuses/<key>.override.ts (enabled, order) | counterpart = src/config/domains/wallet.config.ts, wallet.ui.config.ts
rules:
using:
- reason_key: a grant names its kind with reasonKey, never reason text or meta
- locked_wallet_arg: pass a fetched `wallet` only while holding its row lock in the same tx
- reserve_flow: reserve → consume, and releaseReservation when the work fails
- undo_by_reverse: a wrong transaction is undone by reverseHistory, never by deleting rows
- bonus_display_only: a purchase bonus provider only displays; the grant is a purchaseRequestCompleteHooks item sharing one pure amount function
- lots_init: enabling expiration for a currency runs one lots init for that currency (--wallet-type) right after deploy; never --all while other currencies run; re-enabling re-inits
- from_history_sweep: lots-init-from-history goes with sweepEnabled: true
- notice_cron_first: the notice cron runs at least once before the first expiry date
- notice_window_absolute: a custom notice batch fixes its window as absolute time per run
- terms_match_basis: terms wording follows expirationBasis (grant = FIFO, lastActivity = all)
- lots_prune_required: with frequent grants, keep the wallet-lots-prune cron running (spent lots are deleted only there; without it wallet_lots grows forever) | retention = walletConfig.lotPruneRetentionDays
- notice_scale_before_expiry: right after wallet:lots-init every balance expires on one day → raise sendConcurrency and shorten the notice cron interval before that first expiry date (within the mail provider's rate limit and DB connections)
- reason_category_from_key: with reasonKey the history's reason_category comes from that kind's category; never pass a reasonCategory that disagrees
editing:
- audit_intervention_only: audit_logs only for intervention (admin-callable) ops, bulk as aggregate; business ops (consume, debit, reserve) stay in wallet_histories only
read: operate balances → Usage | currencies, bonuses, expiry setup → src/domains/core/wallet/Extension.md Extension | methods, tables → src/domains/core/wallet/API.md API | locks, lots, notices, audit → src/domains/core/wallet/Internals.md Internals
