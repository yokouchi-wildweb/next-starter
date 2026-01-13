// src/features/core/user/constants/managerialUserAdmin.ts
// 管理者ユーザー管理画面の定数（自動生成）

import { MANAGERIAL_USER_PROFILES } from "../components/admin/form/managerialUserProfiles";

/** 管理者ユーザー管理画面で選択可能なロール */
export const MANAGERIAL_USER_ROLES = Object.keys(MANAGERIAL_USER_PROFILES);

/** 管理者ユーザー管理画面のデフォルトロール */
export const MANAGERIAL_USER_DEFAULT_ROLE = MANAGERIAL_USER_ROLES[0] ?? "admin";
