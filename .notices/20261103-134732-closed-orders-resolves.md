# DOWNSTREAM NOTICE id:20261103-134732-closed-orders-resolves
from: git@github.com:yokouchi-wildweb/next-starter.git | branch:fix/bundle4 | commit:- (this commit)
date: 2026-11-03T13:47:32+09:00
severity: info
checkpoint: closed-orders-resolves
resolves: 20261025-213656-user-frame-partial-customization, 20261028-171627-built-css-guard-fork-custom-coverage, 20261101-111956-review-admin-layout-lib-promotion, 20261101-153803-bank-transfer-bulk-decision, 20261101-153803-coupon-discount-totals, 20261101-180140-user-header-look-config
change: the council closed these 6 orders with an answer (rejected / withdrawn / done); this notice carries their resolves: so forks' temporary permits on them expire. Rule aligned: .notices/README.md「解決(resolves)」, .claude/skills/ship/SKILL.md and src/lib/forkOwnership/README.md now say a closed downstream order gets resolves: whatever the outcome (rejected / withdrawn included), as /inbox already did
why: a permit on a rejected order never expired, so the fork's edit stayed silently allowed; the outcome stays readable in done/ RESOLUTION (/wen)
required_actions: none
verify: pnpm ownership:check — a permit citing only these ids reads expired-resolved
manual_steps: -
refs: ~/.team/orders/next-starter/done/<id>.md RESOLUTION for each id | .notices/README.md「解決(resolves)」
notes: No permit in the downstream forks cites these ids today (checked TriQ, boardgame-site, oripa-do; 88-base and next-vnx have no .fork-ownership/). A fork that adds one later: read the RESOLUTION; for a rejection revert, move to a receptacle, or re-permit under another order
