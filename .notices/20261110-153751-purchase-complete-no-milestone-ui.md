# DOWNSTREAM NOTICE id:20261110-153751-purchase-complete-no-milestone-ui
from: git@github.com:yokouchi-wildweb/next-starter.git | branch:quest/nomad | commit:- (this commit)
date: 2026-11-10T15:37:51+09:00
severity: info
checkpoint: purchase-complete-no-milestone-ui
resolves: 20261101-173617-purchase-complete-remove-milestone-ui
change: PurchaseComplete (src/features/core/purchaseRequest/components/PurchaseComplete/index.tsx) no longer renders MilestoneNotifications; MilestoneNotifications stays a public part and milestoneResults stays in the purchase status API, usePurchaseStatus and its types
why: where to show an achievement is the fork's business decision; with no renderer the default part printed the raw milestone key to users
required_actions: none
verify: pnpm typecheck passes including upstream _screen/* default screens even where your page.tsx points to _components/; a failure there = your fork's core edit is not backward compatible (CLAUDE.md CORE_FILES fork_core_edit_compat) — fix the core side, do not edit the upstream Screen
manual_steps: -
refs: src/features/core/milestone/README.md section 「表示する場所」 | src/features/core/milestone/components/MilestoneNotifications.tsx | order 20261101-173617-purchase-complete-remove-milestone-ui
notes: a fork that wants the display on the purchase complete page places `<MilestoneNotifications results={purchaseInfo.milestoneResults} />` (gated by useGate().enabled("milestone")) in its own _components/ Screen, see the README section | read-only check of the 5 forks in fleet.conf (88-base, triq, boardgame-site, next-vnx, oripa-do): none places MilestoneNotifications in its own files and only oripa-do defines milestones (it does not show them there), so no fork loses a display it relies on | oripa-do: the temporary permit for its 6-line deletion expires with this notice; on merge take upstream's PurchaseComplete
