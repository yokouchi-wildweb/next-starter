// src/features/core/auth/constants/registration.ts
// 本登録画面の定数（自動生成）

import { APP_FEATURES } from "@/config/app/app-features.config";
import { REGISTRATION_PROFILES } from "../components/Registration/registrationProfiles";

/** 本登録画面で選択可能なロール */
export const REGISTRATION_ROLES = Object.keys(REGISTRATION_PROFILES);

/** 本登録画面のデフォルトロール */
export const REGISTRATION_DEFAULT_ROLE = APP_FEATURES.registration.defaultRole;
