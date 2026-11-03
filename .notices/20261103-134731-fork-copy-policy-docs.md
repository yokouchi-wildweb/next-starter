# DOWNSTREAM NOTICE id:20261103-134731-fork-copy-policy-docs
from: git@github.com:yokouchi-wildweb/next-starter.git | branch:fix/bundle4 | commit:- (this commit)
date: 2026-11-03T13:47:31+09:00
severity: info
checkpoint: fork-copy-policy-docs
resolves: 20261101-174248-copied-from-backfill-on-merge, 20261101-181534-flux-kept-behavior-copies-policy, 20261101-181534-feature-gate-check-all-in-forks
fixes: 20261101-134412-fork-extension-policy
change: .claude/rules/core/extensions.md copy_mark: "no backfill" dropped; new backfill line (when a fork takes in the policy it marks once the existing copies it knows it made, no check, /flux never stops, unknown copies stay unmarked) and kept_behavior_copy line (an existing copy holding behavior stays, marked, while its split order is open; replaced when the public hook ships). Human doc gains one rejected-option row. src/proxies/README.md: FEATURE_GATE_CHECK=all pnpm test:feature-gate is run by upstream and forks alike (fork exceptions in scripts/proxies/alwaysOnExceptions.<fork ID>.mjs)
why: notice 20261101-134412 step 6 said "do not backfill", which left copies the fork knows of unmarked; the policy said nothing about behavior copies waiting for a split order; src/proxies/README.md called the all-check upstream-only while CLAUDE.md, proxy.md and earlier notices tell forks to run it
required_actions: none
verify: read .claude/rules/core/extensions.md copy_mark (backfill / kept_behavior_copy lines) | pnpm test:core-rules passes
manual_steps: -
refs: .claude/rules/core/extensions.md copy_mark | docs/!must-read/フォークでの拡張の方針_コピーと受け口の使い分け.md 不採用の案 | src/proxies/README.md
notes: Backfill is a one-time, unchecked step: at the /flux segment that brings this notice, add line 1 `// copied-from: <upstream path>` to the copies the fork knows it made (optional, never a stop). Replaces step 6's "Do not backfill existing copies" of notice 20261101-134412-fork-extension-policy
