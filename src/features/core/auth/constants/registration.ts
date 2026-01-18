// src/features/core/auth/constants/registration.ts
// 本登録画面のロール設定

import { APP_FEATURES } from "@/config/app/app-features.config";
import { isRoleEnabled } from "@/features/core/user/constants";

/** 本登録画面で選択可能なロール */
export const REGISTRATION_ROLES = APP_FEATURES.auth.signup.allowedRoles.filter(isRoleEnabled);

/** 本登録画面のデフォルトロール */
export const REGISTRATION_DEFAULT_ROLE = APP_FEATURES.auth.signup.defaultRole;
