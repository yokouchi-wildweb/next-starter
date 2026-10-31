# DOWNSTREAM NOTICE id:20261031-124012-user-safe-bulk-update
from: git@github.com:yokouchi-wildweb/next-starter.git | branch:main | commit:- (this commit)
date: 2026-10-31T12:40:12+09:00
severity: action-required
checkpoint: user-safe-bulk-update
resolves: 20261031-121345-user-tag-bulk-add
hotfix: forks have no working way to bulk-update users or add tags in bulk since user-bulk-ops-removed (admin bulk buttons on user return 404)
change: createCrudService gains bulkAddRelation / bulkRemoveRelation (generic /api/[domain]/bulk/add-relation and remove-relation, hooks useBulkAddRelationDomain / useBulkRemoveRelationDomain, BulkBelongsToManyFieldButton mode="add"); userService regains bulkUpdate / bulkUpdateByIds limited to USER_BULK_UPDATE.fields (adminMemo, user_tag_ids; any other column = 400); new hooks useBulkAddUserTags, useBulkRemoveUserTags, useBulkUpdateByIdsUser, useBulkUpdateUser
why: the earlier removal closed the unsafe paths without a safe replacement; forks that wrote per-user loops or raw base calls for this can now use the shared path
required_actions:
1. run `git grep -n "USER_BULK_UPDATE" -- src`; if the fork already declared its own USER_BULK_UPDATE outside src/config/app/user-bulk-update.config.ts, delete the fork's copy and add the fork's own side-effect-free columns to `fields` in that file
2. run `git grep -nE "useBulkUpdateUser|useBulkUpdateByIdsUser|useBulkAddUserTags|useBulkRemoveUserTags" -- src` outside src/features/core/user/hooks/; a hit is a fork hook with the same name: rename the fork's hook or switch its callers to the upstream one
3. only when this commit was cherry-picked and `src/wiring/apiRoute.ts` does not exist in the fork: in `src/app/api/[domain]/bulk/add-relation/route.ts` and `src/app/api/[domain]/bulk/remove-relation/route.ts`, replace the `@/wiring/apiRoute` import with the createDomainRoute import used by the sibling `src/app/api/[domain]/bulk/update-by-ids/route.ts`. This is temporary: when a later upstream merge conflicts on these two files, take the upstream side
4. if the fork has its own per-user loop, or a raw `base` call, that only writes tags or adminMemo, switch it to the new hooks when convenient (optional; the old code keeps working)
verify: `pnpm typecheck` passes
manual_steps: -
refs: src/features/core/user/README.md (一括更新) | src/lib/crud/README.md (バルク操作) | src/config/app/user-bulk-update.config.ts | 20261020-160000-user-bulk-ops-removed
notes: no schema change, no db:push. Limits: 1000 records and 50 targets per request (400 above that; split on the client). Unknown ids are skipped and returned in unknownIds / unknownTargetIds. Access of the new generic operations follows the domain's write rule, same as bulkUpdateByIds: a domain with a wider write rule opens them equally. name, status, role, email, phoneNumber, password and isDemo stay per-user. The tag path is not closed by enableUserTag: a fork with the flag off must not call it. Forks not checked.
