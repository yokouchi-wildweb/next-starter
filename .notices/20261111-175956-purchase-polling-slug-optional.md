# DOWNSTREAM NOTICE id:20261111-175956-purchase-polling-slug-optional
from: git@github.com:yokouchi-wildweb/next-starter.git | branch:main | commit:- (this commit)
date: 2026-11-11T17:59:56+09:00
severity: info
checkpoint: purchase-polling-slug-optional
change: UsePurchaseStatusPollingParams (src/features/core/purchaseRequest/hooks/usePurchaseStatusPolling.ts) is now a union: { requestId; slug: string; completePath?; failedPath? } | { requestId; slug?: string; completePath: string; failedPath: string }. slug is needed only when completePath or failedPath is omitted (the default /wallet/<slug>/purchase/... paths). Return value, polling, buildPurchaseResultUrl, query order, default URLs and every existing call are unchanged.
why: a fork's own purchase callback that passes both paths has no meaningful slug
required_actions: none
verify: pnpm typecheck; pnpm test src/features/core/purchaseRequest
manual_steps: -
refs: src/features/core/purchaseRequest/README.md (移り先を変える), order 20261111-175550-purchase-polling-slug-optional
notes: optional: a fork that passes both completePath and failedPath with a dummy slug may drop the slug. Passing one path without slug is a type error.
