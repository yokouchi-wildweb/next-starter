# DOWNSTREAM NOTICE id:20261103-130000-user-delete-route-soft-delete
from: git@github.com:yokouchi-wildweb/next-starter.git | branch:fix/bundle4 | commit:- (this commit)
date: 2026-11-03T13:00:00+09:00
severity: action-required
checkpoint: user-delete-route-soft-delete
resolves: 20261101-155047-user-delete-route-bypasses-soft-delete
change: userService.remove (wrappers/remove.ts) now runs softDelete({ userId }) instead of base.remove; the generic DELETE /api/user/:id and useDeleteUser therefore set status withdrawn, record the status transition, run executeCleanup and write the user.soft_deleted audit record in one transaction. An already deleted user now gives 400, an unknown id 404 (before: deletedAt rewritten silently)
why: the generic route skipped the status change, status history (CLAUDE.md user_status_history), cleanup and audit of softDelete; fork code calling userService.remove now gets the full steps and the new 400 / 404
required_actions:
1. git grep -n "userService.remove\|useDeleteUser\|userClient.delete" -- src; for each fork-owned hit check it does not rely on removing an already deleted user being a no-op (it now throws DomainError 400) and does not run its own setStatusWithdrawn / recordStatusTransition / audit for the same delete (that would now be done twice); remove such duplicate steps
2. pnpm typecheck
verify: pnpm typecheck passes | the grep in step 1 shows no fork caller that repeats softDelete's steps
manual_steps: -
refs: src/features/core/user/services/server/wrappers/remove.ts, src/features/core/user/services/server/wrappers/softDelete.ts, src/features/core/user/README.md
notes: upstream has no server caller of userService.remove (softDelete itself uses base.remove); useDeleteUser had 0 callers in next-starter, oripa-do, boardgame-site, pandora, next-vnx at order time (order refs); other forks not checked. Route not run live (needs auth + DB)
