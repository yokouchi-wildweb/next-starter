// src/features/auth/constants/session.ts

import type { ResponseCookie } from "next/dist/compiled/@edge-runtime/cookies";

import { SESSION_COOKIE_NAME } from "@/lib/jwt";

/**
 * セッション Cookie を発行する際の共通オプション。
 * - 共通のオプションを1箇所に集約することで、各 API ルートからの設定漏れを防ぐ。
 */
export const SESSION_COOKIE_BASE_OPTIONS: Pick<
  ResponseCookie,
  "sameSite" | "httpOnly" | "secure" | "path"
> = {
  // CSRF 対策のため Lax に設定し、通常の遷移でのみ Cookie を送信する。
  sameSite: "lax",
  // JavaScript からの読み出しを禁止し、XSS からトークンを守る。
  httpOnly: true,
  // HTTPS 通信でのみ送信させ、平文送信を防止する。
  secure: true,
  // ルート配下のすべてのパスに Cookie を適用する。
  path: "/",
};

/**
 * セッション Cookie 名を再エクスポートしておくことで、
 * - ドメイン内での import を簡潔にし、統一した定数利用を担保する。
 */
export const AUTH_SESSION_COOKIE_NAME = SESSION_COOKIE_NAME;
