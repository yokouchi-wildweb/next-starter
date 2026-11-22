# DOWNSTREAM NOTICE id:20261122-192637-covers-check-history
from: git@github.com:yokouchi-wildweb/next-starter.git | branch:main | commit:- (this commit)
date: 2026-11-22T19:26:37+09:00
severity: info
checkpoint: covers-check-history
resolves: 20261122-002750-covers-check-needs-deleted-body
change: pnpm check notices: covers: and fixes: targets count as existing when the notice body is in the work tree or in history (a body deleted after its segment closed passes); the covers: check moved into scripts/workflow/notices/noticeFields.mjs (checkCovers, run by checkFields)
why: upstream deletes bodies of notices whose segment closed, so a middle tier's relay notice naming such an id in covers: failed the check for good; existence now follows the history rule every other reader uses (D350)
required_actions:
1. a middle tier that passes the covers: check by a waiver or a temporary permit citing 20261122-002750-covers-check-needs-deleted-body: remove it (find: `git grep -n '20261122-002750-covers-check-needs-deleted-body' -- .claude/rules .fork-ownership ':!.claude/rules/core' ':!.claude/rules/items'`); none → nothing to do
verify: pnpm check notices passes, a relay notice whose covers: names a deleted upstream body included
manual_steps: -
refs: scripts/workflow/notices/noticeFields.mjs (checkCovers), scripts/workflow/notices/notices.test.mjs, scripts/workflow/notices/noticeFields.test.mjs, .notices/README.md | order 20261122-190305-quest-covers-check-needs-deleted-body
notes: an id in neither the work tree nor the history still fails | the fixes: existence pre-check reads the same history set
