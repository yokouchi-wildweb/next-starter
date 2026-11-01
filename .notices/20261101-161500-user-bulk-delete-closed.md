# DOWNSTREAM NOTICE id:20261101-161500-user-bulk-delete-closed
from: git@github.com:yokouchi-wildweb/next-starter.git | branch:main | commit:3dbd9e4f
date: 2026-11-01T16:15:00+09:00
severity: action-required
checkpoint: -
resolves: 20261031-123649-user-bulk-delete-bypasses-soft-delete
change: userService no longer exposes bulkDeleteByIds / bulkDeleteByQuery | POST /api/user/bulk/delete-by-ids and /api/user/bulk/delete-by-query return 404 to allowed callers | hooks useBulkDeleteByIdsUser and useBulkDeleteByQueryUser deleted
why: these paths set deletedAt without the status change, status history, cleanup or user.soft_deleted audit record of softDelete; a fork using them gets a tsc error or a runtime 404
required_actions:
1. git grep -n "useBulkDeleteByIdsUser\|useBulkDeleteByQueryUser\|userService.bulkDelete" -- src; rewrite each hit to delete users one by one with useSoftDeleteUser or userService.softDelete
2. git grep -n "userClient.bulkDelete\|bulk/delete-by-ids\|bulk/delete-by-query\|BulkDeleteButton" -- src; these give a 404 with no tsc error when the domain is user: rewrite the same way
verify: `pnpm typecheck` passes and the greps in steps 1-2 return no hits for the user domain
manual_steps: -
refs: src/features/core/user/services/server/userService.ts, src/features/core/user/README.md, .notices/20261020-160000-user-bulk-ops-removed.md
notes: checkpoint - : same reason as 20261101-161100-wallet-lock-balance. Deleted: src/features/core/user/hooks/useBulkDeleteByIdsUser.ts, src/features/core/user/hooks/useBulkDeleteByQueryUser.ts; a fork-owned caller moves to useSoftDeleteUser. oripa-do, boardgame-site, pandora, next-vnx had no caller of the 2 hooks at their HEAD by git grep; their direct client calls and other forks not checked. Routes not run live; 404 read from createDomainRoute ensureSupports, service shape checked by script. DELETE /api/user/:id still bypasses softDelete, order 20261101-155047-user-delete-route-bypasses-soft-delete.
