# DOWNSTREAM NOTICE id:20261020-161000-purchase-onexpire-all-expire-paths
from: git@github.com:yokouchi-wildweb/next-starter.git | branch:main | commit:- (this commit)
date: 2026-10-20T16:10:00+09:00
severity: info
checkpoint: purchase-onexpire-all-expire-paths
change: PurchaseCompletionStrategy.onExpire is now called on every transition to `expired`. New callers: cancelPurchase (user cancel, same tx; a throw rolls back the cancel and the user gets an error) and expireStaleClientSdkSessions (abandoned PayPal / Paidy processing rows, per-row tx; a throw is logged and the row stays processing). Existing callers (expirePendingRequests, cancelPending) unchanged.
why: user cancel and stale client_sdk cleanup moved rows to expired without the hook, so purchase types holding side tables (reservations, held stock) leaked them. Forks that implemented onExpire assuming it only runs from the expire cron should check the new call contexts.
required_actions:
1. `grep -rn "onExpire" src --include=*.ts` outside src/features/core/purchaseRequest/. For each fork strategy that defines onExpire, confirm it (a) is idempotent, (b) handles a purchaseRequest whose previous status was `processing` as well as `pending`, (c) does not rely on running outside a user request (no long external calls: it now runs inside the cancel API request tx). Fix the strategy if not. No change if the fork defines no onExpire.
verify: `pnpm tsc --noEmit` passes; any fork onExpire satisfies (a)-(c).
manual_steps: -
refs: src/features/core/purchaseRequest/services/server/wrappers/cancelPurchase.ts, src/features/core/purchaseRequest/services/server/wrappers/expireStaleSessions.ts, src/features/core/purchaseRequest/services/server/completion/types.ts, src/features/core/purchaseRequest/README.md §6.2, upstream-request 20261019-124257-cancel-purchase-skips-strategy-hooks
notes: no schema change. Forks that worked around the gap by cleaning side tables in their own cancel wrapper should remove the duplicate cleanup (or keep it only if idempotent). Forks: not checked.
