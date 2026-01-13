// src/features/core/user/constants/generalUserAdmin.ts
// 一般ユーザー管理画面の定数（自動生成）

import { GENERAL_USER_PROFILES } from "../components/admin/form/generalUserProfiles";

/** 一般ユーザー管理画面で選択可能なロール */
export const GENERAL_USER_ROLES = Object.keys(GENERAL_USER_PROFILES);

/** 一般ユーザー管理画面のデフォルトロール */
export const GENERAL_USER_DEFAULT_ROLE = GENERAL_USER_ROLES[0] ?? "user";
