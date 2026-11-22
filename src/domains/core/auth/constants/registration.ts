// src/domains/core/auth/constants/registration.ts
// 本登録画面のロール設定

import { authConfig } from "@/domains/auth/config";
import { isRoleEnabled } from "@/domains/core/user/constants";

/** 本登録画面で選択可能なロール */
export const REGISTRATION_ROLES = authConfig.signup.allowedRoles.filter(isRoleEnabled);

/** 本登録画面のデフォルトロール */
export const REGISTRATION_DEFAULT_ROLE = authConfig.signup.defaultRole;
