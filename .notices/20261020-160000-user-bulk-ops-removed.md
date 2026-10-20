# DOWNSTREAM NOTICE id:20261020-160000-user-bulk-ops-removed
from: git@github.com:yokouchi-wildweb/next-starter.git | branch:main | commit:-
date: 2026-10-20T16:00:00+09:00
severity: action-required
checkpoint: user-bulk-ops-removed
change: userService no longer exposes upsert / bulkUpsert / bulkUpdate / bulkUpdateByIds / replaceByQuery / duplicate (generic /api/user/** routes for them now 404); hooks useUpsertUser / useBulkUpsertUser / useBulkUpdateUser / useDuplicateUser deleted; CSV import rejects any domain whose domain.json has useImportExport:false
why: these paths bypassed the users.name uniqueness guard, recordStatusTransition, Firebase sync and session invalidation; a fork still calling them gets a tsc error (hooks / userService.<op>) or a 404 at runtime
required_actions:
1. grep the fork for `useUpsertUser`, `useBulkUpsertUser`, `useBulkUpdateUser`, `useDuplicateUser`, and `userService.(upsert|bulkUpsert|bulkUpdate|bulkUpdateByIds|replaceByQuery|duplicate)` outside src/features/core/; for each hit, rewrite to per-user `userService.update` / `create` (or their hooks useUpdateUser / useCreateUser); server code that truly needs a raw bulk write imports `base` from src/features/core/user/services/server/drizzleBase and handles name uniqueness + recordStatusTransition itself
2. grep the fork's client code for axios/userClient calls to `/api/user/upsert`, `/api/user/bulk/upsert`, `/api/user/bulk/update`, `/api/user/bulk/update-by-ids`, `/api/user/bulk/replace-by-query`, `/api/user/<id>/duplicate` and rewrite them the same way
3. list fork domains with `"useImportExport": false` in domain.json; if any of them is imported through the data migration API on purpose, set it to true and run `pnpm dc:generate <Domain>`
verify: `npx tsc --noEmit` passes and the greps in steps 1-2 return no hits outside src/features/core/
manual_steps: -
refs: src/features/core/user/services/server/userService.ts, src/lib/dataMigration/import/importChunk.ts, src/features/core/user/README.md (一意性 section)
notes: upstream-request 20261015-233910-user-name-guard-bypass. Also shipped (no fork action): name guard now runs on isDemo true→false, restore locks suffix candidates, admin create/edit forms validate name with UserNameFormSchema. Forks not checked.
