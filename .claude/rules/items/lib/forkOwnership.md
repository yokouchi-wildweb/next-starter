---
paths:
  - "src/lib/forkOwnership/**"
---
# lib/forkOwnership
what: the fork ownership check (pnpm workflow ownership check) and the owner lookup (pnpm workflow ownership who), with intake.txt, permits and repo.json readers
use: always
change: none → /order <direct parent>
rules:
using:
- check_after_commit: the check reads committed HEAD only → run it after the commit and before the push
- permit_from_draft: write a permit line from the draft the check prints (plain git hash-object differs)
- permit_scope: a permit covers only what no intake can (no intake yet, upstream bug / perf / security fixes, debt rows) | D/R and ancestor-lib-add permits ask only for a stop switch or a place in that lib | a self-addressed order id is allowed for the fork's own leftover work
- permit_after_reject: a rejected or withdrawn order still expires the permit → revert, move to the intake or re-permit
- fork_regions_only: in region files a fork writes only between the fork entries start / end markers | upstream never edits inside them and announces an added or moved pair by notice
- repo_json_by_command: repo.json is written only by pnpm workflow repo-json (or /fork-init) | names are never derived from the origin URL
- tiers_top_down: in multi-tier, take the upper tier in first; a ledger rename and its `upstream:` line go in the same intake
editing:
- intake_rows: every hand row has a reason | a row naming a fork-only file says so in the reason | the generated block is never hand-edited | a debt row names `upreq:<id>`
- pure_parts: intake / judge / unitNames / permits / regions / lineage stay pure (no git); git only in check, cli, who, baseFiles
- one_judge: who and explain reuse resolveForkContext / judgeFork / judge and never change the check's verdict
read: run the check, who → Usage | intake, permits, regions, repo.json → Extension | functions → src/lib/forkOwnership/API.md API | judge order, tiers → src/lib/forkOwnership/Internals.md Internals
