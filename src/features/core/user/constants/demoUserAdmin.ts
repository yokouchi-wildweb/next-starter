// src/features/core/user/constants/demoUserAdmin.ts
// デモユーザー管理画面の定数

import { getRolesByCategory } from "../utils/roleHelpers";

/** デモユーザー管理画面で選択可能なロール（全カテゴリ） */
export const DEMO_USER_ROLES = [
  ...getRolesByCategory("admin"),
  ...getRolesByCategory("user"),
];

/** デモユーザー管理画面のデフォルトロール */
export const DEMO_USER_DEFAULT_ROLE = DEMO_USER_ROLES[0] ?? "user";
