---
paths:
  - "src/domains/core/user/**"
  - "src/config/domains/user.config.ts"
  - "src/**/plugs/{userAdminManageTabs,userCleanupHandlers,userMypageMenu,userReservedNames}/**"
---
# domains/user
what: users (admins too), roles, status history, display names, delete cleanup | userService
use: always
change: counterpart = src/config/domains/user.config.ts | override = <name>.override.ts | add = items in your own domain's plugs/<point>/ (user's points)
rules:
using:
- no_raw_users_write: users and names are written only via createFromProvider / userService | refuse withdrawn users via findByProvider first, not a createFromProvider option
- self_update: routes with user input → userService.updateSelf, not update
- secrets: findByIdWithSecrets / findByLocalEmail output never reaches HTTP
- ip_search: IP lookups → userLoginEvent, not metadata
- user_name: names from outside → sanitizeUserName, no own forbidden-char list
- name_write (MANDATORY): every write path to users.name uses the shared schemas (entities/userName.ts) and withUserNameGuard, never name rules inline | uniqueness = an app-layer check, not a DB constraint
- status_write (MANDATORY): any code that writes users.status calls recordStatusTransition (services/server/statusHistory.ts)
- no_user_columns: no analytics columns on users → per-concern satellite tables (aggregation axes = typed columns, long tail = jsonb extras)
- delete_one_by_one: delete users one by one (softDelete)
- bulk_fields: no side-effect columns in bulkUpdate.fields (status, role, name, email, phone, password, isDemo)
- reserved_fast: userReservedNames providers read locally only (memory / local table; run under an advisory lock), names normalized as normalizeUserNameForComparison
- no_copy: modal tabs → userAdminManageTabs | mypage cards → userMypageMenu (no gate checks) | avatar → useAvatarChange | user list → useGeneralUserListTable
- menu_own: edit your own mypage item in place, no override | new action kind → /order
- wallet_gate: a file importing wallet parts checks useGate().enabled("wallet")
- cleanup_tx: handlers write only via the passed tx | unsure → required | optional writes in tx.transaction
- unique_check: lockUserName / isUserNameTaken only if name.unique.enabled
editing:
- no_silent_password: newPassword with no password route → 400, never success
read: statuses → Overview | roles, bulk, search, avatar, list → Usage | columns, createFromProvider → src/domains/core/user/API.md API | mypage, cleanup → src/domains/core/user/Extension.md Extension | deletion, history → src/domains/core/user/Internals.md Internals
