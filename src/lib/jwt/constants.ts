// src/lib/jwt/constants.ts

import { APP_FEATURES } from "@/config/app/app-features.config";

/**
 * JWT セッションを保持するクッキー名。
 */
export const SESSION_COOKIE_NAME = APP_FEATURES.auth.session.cookieName;

/**
 * セッショントークンのデフォルト有効期限（秒）。
 * 現状では 7 日間を基準とする。
 */
export const SESSION_DEFAULT_MAX_AGE_SECONDS =
  APP_FEATURES.auth.session.defaultMaxAgeSeconds;

/**
 * JWT の署名アルゴリズム。
 */
export const SESSION_JWT_ALGORITHM = "HS256" as const;
