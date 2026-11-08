# DOWNSTREAM NOTICE id:20261109-065317-stopgap-permit-recite
from: git@github.com:yokouchi-wildweb/next-starter.git | branch:main | commit:- (this commit)
date: 2026-11-08T21:53:17Z
severity: action-required
checkpoint: stopgap-permit-recite
resolves: 20261108-102030-resolves-keeps-stopgap-permits
change: Docs and the /ship skill only (no change to pnpm workflow ownership check): a notice that closes an order with resolves: never tells forks to keep a temporary permit citing that order id; when fork-side work remains, it tells them to re-cite the permit's upreq: with an order id the fork files to itself (.notices/README.md 「解決(resolves)」, .claude/skills/ship/SKILL.md step 3). src/lib/forkOwnership/README.md 「一時許可」: for a stopgap that is not upstream work, upreq: may be the fork's own self-addressed order id (the check validates only the id shape).
why: resolves: 20261108-102030 expires every permit row that cites only that id. oripa-do cites it on 3 rows; without re-citing, pnpm workflow ownership check fails with expired-resolved right after this notice.
required_actions:
1. In .fork-ownership/<your fork_id>.permits.txt, find the rows citing the resolved order: git grep -n "20261108-102030-resolves-keeps-stopgap-permits" -- .fork-ownership. No hits → nothing to do.
2. For each hit (oripa-do: src/features/core/analytics/entities/drizzle.ts, src/features/core/purchaseRequest/entities/drizzle.ts, src/features/core/walletHistory/entities/drizzle.ts), replace upreq:20261108-102030-resolves-keeps-stopgap-permits with upreq:<your own self-addressed order for the remaining fork-side work> (oripa-do: 20261108-100132-analytics-exclusion-satellite-table). Keep base:, head: and the reason; update the reason's text to name the self order. Do it before taking this notice or in the same segment.
verify: pnpm workflow ownership check passes and shows the re-cited rows as valid (permitted) | git grep from step 1 shows no hit
manual_steps: -
refs: .notices/README.md 「解決(resolves)」, src/lib/forkOwnership/README.md 「一時許可」, .claude/skills/ship/SKILL.md, notice 20261105-115033-analytics-exclusion-providers (required_actions 2 had the contradicting shape), council 20261020-195854 D93, order 20261109-064243-quest-stopgap-permit-docs
notes: Per fork (read-only): oripa-do .fork-ownership/oripa-do.permits.txt rows 1, 2, 7 cite 20261108-102030 → step 2; its self order 20261108-100132-analytics-exclusion-satellite-table is in ~/.team/orders/oripa-do/. Other forks not checked (step 1's grep finds nothing for them). The self-order rows stay until the fork moves its data and deletes them, or until upstream touches the file (expired-base).
