---
paths:
  - "src/features/core/user/**"
  - "src/config/features/user.config.ts"
---
# features/user
what: users (admins and users in one table), roles, status + history, display names, delete cleanup | userService
use: always
change: overlay = src/config/features/user.config.ts, <name>.override.ts | add = receptacles (extensionPoints.ts)
rules:
using:
- self_update: routes passing user input → userService.updateSelf, never update
- secrets: findByIdWithSecrets / findByLocalEmail never reach an HTTP response
- ip_search: IP lookups → userLoginEvent, never metadata JSONB
- user_name: names from outside → sanitizeUserName, never an own forbidden-char list (CLAUDE.md user_name)
- delete_one_by_one: delete users one at a time with softDelete
- bulk_fields: no side-effect columns in bulkUpdate.fields (status, role, name, email, phone, password, isDemo)
- reserved_fast: reservedNames providers read a local table only (under an advisory lock)
- no_copy: modal tabs → adminManageTabs | mypage cards → mypageMenu (no gate checks) | avatar → useAvatarChange | user list → useGeneralUserListTable
- menu_own: your own mypage item is edited in place, never overridden | a new action kind → /order
- wallet_gate: a file importing wallet parts checks useGate().enabled("wallet") itself
- cleanup_tx: handlers write only via the passed tx | unsure → required | optional writes in tx.transaction
- unique_check: lockUserName / isUserNameTaken only when name.unique.enabled
editing:
- status_history: every users.status write → recordStatusTransition (CLAUDE.md user_status_history)
- no_silent_password: newPassword without a password route → 400, never silent success
read: statuses → Overview | roles, bulk, search, avatar, list → Usage | columns, createFromProvider → src/features/core/user/API.md API | mypage, cleanup → src/features/core/user/Extension.md Extension | deletion, history → src/features/core/user/Internals.md Internals
