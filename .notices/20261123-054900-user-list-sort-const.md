# DOWNSTREAM NOTICE id:20261123-054900-user-list-sort-const
from: git@github.com:yokouchi-wildweb/next-starter.git | branch:main | commit:(this commit)
date: 2026-11-23T05:49:00+09:00
severity: action-required
checkpoint: user-list-sort-const
resolves: 20261123-054645-user-list-sort-const-out-of-client-module
change: DEFAULT_USER_LIST_SORT_OPTIONS and its type UserListSortOption moved out of the "use client" module src/domains/core/user/components/common/UserListHeader.tsx into the plain module src/domains/core/user/constants/userListSort.ts (same names, same values; UserListHeader imports them from there and no longer exports them). A server component (Screen, loader) can now import and spread the default sort options; spreading the old export there got a client reference and a 500. UserListHeader's props are unchanged
why: the user README's example (section 3, sort options) led forks to spread the constant in a server component, where an export of a "use client" module is a client reference, not the array
required_actions:
1. Fork code that imports DEFAULT_USER_LIST_SORT_OPTIONS or UserListSortOption from the UserListHeader module → import them from @/domains/core/user/constants/userListSort (pnpm typecheck fails on the old import). Find: git grep -nE "DEFAULT_USER_LIST_SORT_OPTIONS|UserListSortOption" -- src ':!src/domains/core'
2. A fork copy kept only to avoid the client reference (e.g. a hand-written sort list in a server Screen) can spread DEFAULT_USER_LIST_SORT_OPTIONS from the new module instead
verify: pnpm typecheck passes | the admin user list renders with the extra sort options from a server component
manual_steps: -
refs: src/domains/core/user/README.md (UserListHeader, ヘッダーに並び替えを足す)
notes: specifier: @/domains/core/user/components/common/UserListHeader (DEFAULT_USER_LIST_SORT_OPTIONS, UserListSortOption) -> @/domains/core/user/constants/userListSort | not added to the constants index (it re-exports role helpers that read the roles registry) | a temporary permit citing the resolved order expires with this notice
