// src/domains/core/user/constants/userListSort.ts
//
// 管理の利用者一覧の並べ替えの候補(UserListHeader の sortOptions)。
// "use client" のモジュールの外に置くので、server component(Screen・loader)からも読み、広げて足せる。

export type UserListSortOption = { label: string; value: string };

/** 既定の並べ替えの候補(登録日順・更新日順)。fork は `[...DEFAULT_USER_LIST_SORT_OPTIONS, 足す候補]` で渡す */
export const DEFAULT_USER_LIST_SORT_OPTIONS: UserListSortOption[] = [
  { label: "登録日順", value: "createdAt" },
  { label: "更新日順", value: "updatedAt" },
];
