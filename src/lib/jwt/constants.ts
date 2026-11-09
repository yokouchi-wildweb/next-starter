// src/lib/jwt/constants.ts

import { jwtConfig } from "./config";

/**
 * JWT セッションを保持するクッキー名(設定 cookieName、既定 "__session")。
 */
export const SESSION_COOKIE_NAME = jwtConfig.cookieName;

/**
 * セッショントークンのデフォルト有効期限(秒、設定 defaultMaxAgeSeconds、既定 7 日)。
 */
export const SESSION_DEFAULT_MAX_AGE_SECONDS = jwtConfig.defaultMaxAgeSeconds;

/**
 * JWT の署名アルゴリズム。
 */
export const SESSION_JWT_ALGORITHM = "HS256" as const;
