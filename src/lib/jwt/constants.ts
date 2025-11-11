// src/lib/jwt/constants.ts

import { SESSION_DEFAULT_MAX_AGE_SECONDS as SESSION_DEFAULT_MAX_AGE_SECONDS_OVERRIDE, SESSION_COOKIE_NAME as SESSION_COOKIE_NAME_OVERRIDE } from "@/constants/session";

const FALLBACK_SESSION_COOKIE_NAME = "__session" as const;
const FALLBACK_SESSION_DEFAULT_MAX_AGE_SECONDS = 60 * 60 * 24 * 7; // 7 days

/**
 * JWT セッションを保持するクッキー名。
 */
export const SESSION_COOKIE_NAME =
  SESSION_COOKIE_NAME_OVERRIDE ?? FALLBACK_SESSION_COOKIE_NAME;

/**
 * セッショントークンのデフォルト有効期限（秒）。
 * 現状では 7 日間を基準とする。
 */
export const SESSION_DEFAULT_MAX_AGE_SECONDS =
  SESSION_DEFAULT_MAX_AGE_SECONDS_OVERRIDE ??
  FALLBACK_SESSION_DEFAULT_MAX_AGE_SECONDS;

/**
 * JWT の署名アルゴリズム。
 */
export const SESSION_JWT_ALGORITHM = "HS256" as const;
