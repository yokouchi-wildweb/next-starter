# DOWNSTREAM NOTICE id:20261122-223210-hotfix-notice-tool
from: git@github.com:yokouchi-wildweb/next-starter.git | branch:build/20261106-194813-tooling-ownership-and-growth.2 | commit:- (this commit)
date: 2026-11-22T13:32:10Z
severity: info
checkpoint: hotfix-notice-tool
change: a fix that only replaces the tool of the notice it fixes (.notices/<fixed id>.<name>.mjs, its .test.mjs too) now passes the ship's checks: pnpm workflow notices pickCheck counts that replacement as the commit's body (no 「commit に本体が無い」) when the fix notice's fixes: names that notice, and pnpm check notices accepts it in uses: (the codemod name rule allows the own id or a fixes: id) | a commit with only unrelated .notices files, or a uses: codemod of a notice fixes: does not name, is refused as before | new export isFixedNoticeTool in scripts/workflow/notices/pickCheck.mjs; commitConditions takes the fixes ids as a third argument
why: a hotfix of a notice's codemod alone was refused twice (no body outside .notices, codemod not named after the fix's own id) and had to drop uses: and hotfix: to ship; the guarded thing — something in the commit a fork can pick ahead — is there
required_actions: none
verify: pnpm test scripts/workflow/notices/pickCheck.test.mjs scripts/workflow/notices/noticeFields.test.mjs
manual_steps: -
refs: scripts/workflow/notices/pickCheck.mjs (commitConditions, isFixedNoticeTool) | scripts/workflow/notices/noticeFields.mjs (checkUses) | .notices/README.md 「使う移行・codemod の欄」「緊急修正(hotfix)」 | .claude/skills/ship/SKILL.md NOTICE COMPOSITION uses:
notes: your own /ship of such a fix: edit .notices/<fixed id>.<name>.mjs, write the fix notice with fixes: <fixed id> and uses: that path (hotfix: when the human calls it urgent), all in one commit
