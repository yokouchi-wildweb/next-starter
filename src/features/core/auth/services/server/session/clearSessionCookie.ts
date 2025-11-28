// src/features/auth/services/server/session/clearSessionCookie.ts

import type { ResponseCookies } from "next/dist/compiled/@edge-runtime/cookies";

import { SESSION_COOKIE_BASE_OPTIONS, AUTH_SESSION_COOKIE_NAME } from "@/features/core/auth/constants/session";

export type ClearSessionCookieParams = {
  // Cookie を操作するために Next.js の ResponseCookies を受け取る。
  cookies: ResponseCookies;
};

/**
 * セッション Cookie を明示的に削除する。
 * - ログアウト時や検証失敗時に空値を上書きし、ブラウザ側のトークンを確実に無効化する。
 */
export function clearSessionCookie({ cookies }: ClearSessionCookieParams): void {
  // 空文字と過去日付を設定し、ブラウザに即時削除を指示する。
  cookies.set(AUTH_SESSION_COOKIE_NAME, "", {
    ...SESSION_COOKIE_BASE_OPTIONS,
    // maxAge を 0 にすることで、受信後すぐに破棄させる。
    maxAge: 0,
    // 1970-01-01 を指定し、expires による削除も同時に行う。
    expires: new Date(0),
  });
}
