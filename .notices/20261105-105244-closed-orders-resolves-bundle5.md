# DOWNSTREAM NOTICE id:20261105-105244-closed-orders-resolves-bundle5
from: git@github.com:yokouchi-wildweb/next-starter.git | branch:fix/bundle5 | commit:- (this commit)
date: 2026-11-05T10:52:44+09:00
severity: info
checkpoint: closed-orders-resolves-bundle5
resolves: 20261031-134813-bulk-relation-mode-switch, 20261101-111956-intake-purchase-discount-on-redeemed
change: the council closed these 2 orders with an answer (both rejected, council D46: fork-side means exist); this notice carries their resolves: so forks' temporary permits on them expire. No code change
why: a permit on a closed order expires only when a shipped notice resolves it; the answers (what to do instead) are in done/ RESOLUTION
required_actions: none
verify: pnpm ownership:check — a permit citing only these ids reads expired-resolved
manual_steps: -
refs: ~/.team/orders/next-starter/done/<id>.md RESOLUTION for each id | .notices/README.md「解決(resolves)」
notes: bulk-relation-mode-switch → pass mode="add" in the fork's own call; intake-purchase-discount-on-redeemed → a purchase-complete hook item in hooks/definitions/<name>.ts. No permit in the downstream forks cites these ids today (checked 88-base, TriQ, boardgame-site, next-vnx, oripa-do). A fork that has an edit under one of them: read the RESOLUTION and move the change to the named means
