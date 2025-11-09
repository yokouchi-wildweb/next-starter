// src/features/auth/services/server/session/issueSessionCookie.ts

import type { ResponseCookies } from "next/dist/compiled/@edge-runtime/cookies";

import { SESSION_COOKIE_BASE_OPTIONS, AUTH_SESSION_COOKIE_NAME } from "@/features/auth/constants/session";

export type IssueSessionCookieParams = {
  // Next.js の ResponseCookies インスタンス。レスポンスに対して Cookie を設定するために受け取る。
  cookies: ResponseCookies;
  // JWT 署名済みのセッショントークン。Cookie 値としてそのまま書き込む。
  token: string;
  // 有効期限。Cookie の expires に連動させてクライアントとサーバーで同一の失効時刻を共有する。
  expiresAt: Date;
  // maxAge を明示的に指定する場合の値。未指定時は expires との差分から算出する。
  maxAge?: number;
};

/**
 * 署名済み JWT をセッション Cookie として書き込む。
 * - Cookie の寿命は expires と maxAge の双方で制御し、ブラウザ差異を吸収する。
 */
export function issueSessionCookie({ cookies, token, expiresAt, maxAge }: IssueSessionCookieParams): void {
  // maxAge が指定されていない場合は、expires と現在時刻の差分を秒単位で求める。
  const computedMaxAge =
    typeof maxAge === "number" ? maxAge : Math.max(0, Math.floor((expiresAt.getTime() - Date.now()) / 1000));

  // 計算済みの maxAge と共通オプションを用いて Cookie を設定する。
  cookies.set(AUTH_SESSION_COOKIE_NAME, token, {
    ...SESSION_COOKIE_BASE_OPTIONS,
    // ブラウザ側での期限切れタイミングを正確に伝えるために expires を指定。
    expires: expiresAt,
    // computedMaxAge を設定し、再ログイン時に即時失効しないようにする。
    maxAge: computedMaxAge,
  });
}
