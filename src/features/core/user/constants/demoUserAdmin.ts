// src/features/core/user/constants/demoUserAdmin.ts
// デモユーザー管理画面の定数（自動生成）

import { DEMO_USER_PROFILES } from "../components/admin/form/demoUserProfiles";

/** デモユーザー管理画面で選択可能なロール */
export const DEMO_USER_ROLES = Object.keys(DEMO_USER_PROFILES);

/** デモユーザー管理画面のデフォルトロール */
export const DEMO_USER_DEFAULT_ROLE = DEMO_USER_ROLES[0] ?? "user";
