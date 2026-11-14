// src/features/core/userGroup/hooks/userGroupKeys.ts
//
// ユーザーグループの管理の SWR のキー。保存・保管・例外・一員の操作は 1 件のキーを取り直す

export const USER_GROUPS_KEY = "userGroup/admin/groups";
export const USER_GROUP_CRITERIA_KEY = "userGroup/admin/criteria";

/** 1 件のキー */
export const userGroupKey = (id: string) => `${USER_GROUPS_KEY}/${id}`;
