// src/features/core/user/constants/managerialUserAdmin.ts
// 管理者ユーザー管理画面の定数

import { getRolesByCategory } from "../utils/roleHelpers";

/** 管理者ユーザー管理画面で選択可能なロール */
export const MANAGERIAL_USER_ROLES = getRolesByCategory("admin");

/** 管理者ユーザー管理画面のデフォルトロール */
export const MANAGERIAL_USER_DEFAULT_ROLE = MANAGERIAL_USER_ROLES[0] ?? "admin";
