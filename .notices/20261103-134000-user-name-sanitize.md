# DOWNSTREAM NOTICE id:20261103-134000-user-name-sanitize
from: git@github.com:yokouchi-wildweb/next-starter.git | branch:fix/bundle4 | commit:- (this commit)
date: 2026-11-03T13:40:00+09:00
severity: action-required
checkpoint: user-name-sanitize
resolves: 20261102-114757-user-name-sanitize
change: src/features/core/user/entities/userName.ts exports sanitizeUserName(raw): string — removes the characters the shared schemas reject (Cc, Cf, Zl, Zp), trims, and cuts to USER_NAME_CONFIG.maxLength without splitting a surrogate pair. May return "". Existing schemas and messages unchanged; USER_NAME_FORBIDDEN_CHARS stays private
why: forks that turn a sign-in provider's display name into users.name kept their own copy of the forbidden characters, which drifts from the user_name rule
required_actions:
1. git grep -nE "FORBIDDEN_NAME_CHARS|\\\\p\\{Cc\\}" -- src ':!src/features/core'; replace each fork-owned copy that cleans a display name with sanitizeUserName from "@/features/core/user/entities/userName" (core import path; use the fork's alias if it has one), and delete the copy. Keep the fork's fallback for an empty result, and keep saving through withUserNameGuard
2. pnpm typecheck
verify: pnpm typecheck passes | pnpm test:user-name passes | step 1 grep shows no fork-owned copy of the forbidden character list
manual_steps: -
refs: src/features/core/user/entities/userName.ts, src/features/core/user/entities/userName.test.ts, src/features/core/user/README.md「バリデーション」
notes: boardgame-site src/features/lineSignIn/services/server/createLineUser.ts FORBIDDEN_NAME_CHARS named in the order; not read here. Other forks not checked
