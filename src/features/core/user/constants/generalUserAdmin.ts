// src/features/core/user/constants/generalUserAdmin.ts
// 一般ユーザー管理画面の定数

import { getRolesByCategory } from "../utils/roleHelpers";

/** 一般ユーザー管理画面で選択可能なロール */
export const GENERAL_USER_ROLES = getRolesByCategory("user");

/** 一般ユーザー管理画面のデフォルトロール */
export const GENERAL_USER_DEFAULT_ROLE = GENERAL_USER_ROLES[0] ?? "user";
