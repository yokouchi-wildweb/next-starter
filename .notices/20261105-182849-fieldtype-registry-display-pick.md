# DOWNSTREAM NOTICE id:20261105-182849-fieldtype-registry-display-pick
from: git@github.com:yokouchi-wildweb/next-starter.git | branch:legate/20261023-175358-scripts-rules.1 | commit:- (this commit)
date: 2026-11-05T18:28:49+09:00
severity: info
checkpoint: fieldtype-registry-display-pick
fixes: 20261029-174708-fieldtype-shared-table
change: src/features/core/purchaseQuota/entities/display.ts regenerated (pnpm registry:generate) at the fieldtype-shared-table checkpoint (c19dbe47): 4 fieldType values text -> string, matching the domain.json that checkpoint changed. Side commit on c19dbe47 so /flux can pick it right after that segment. No behavior change
why: c19dbe47 changed purchaseQuota/domain.json fieldType text -> string without regenerating its client display copy, so pnpm registry:check failed at every fieldtype checkpoint 20261029-174708..193321 (found by the upstream checkpoint check). The same change reached main only in 29085ca6, about 30 commits later
required_actions: none
verify: pnpm registry:check exit 0 at the fieldtype-shared-table segment after the pick
manual_steps: -
refs: src/features/core/purchaseQuota/entities/display.ts | commit 29085ca6
notes: the commit is a side commit on c19dbe47 merged --no-ff into main; its content is already on main since 29085ca6 (the merge adds only this notice). A fork already past 29085ca6 has nothing to apply. The later fieldtype checkpoints do not touch display.ts, so the picked version survives their merges. The typecheck break at fieldtype-list-presenter-for is fixed separately by 20261105-110501-presenterfor-readonly-pick
