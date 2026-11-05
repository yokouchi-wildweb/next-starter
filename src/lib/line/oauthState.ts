// src/lib/line/oauthState.ts

import { randomBytes } from "crypto";

import { sanitizeRedirectPath } from "@/lib/url";

import { LINE_OAUTH_NONCE_COOKIE } from "./constants";

/** nonce cookie の有効期限 (秒)。LINE の認可画面から戻るまでの猶予 */
export const LINE_OAUTH_STATE_MAX_AGE_SECONDS = 600;

/** issueOAuthState が返す nonce cookie (NextResponse の cookies.set にそのまま渡せる形) */
export type LineOAuthNonceCookie = {
  name: string;
  value: string;
  httpOnly: true;
  secure: boolean;
  sameSite: "lax";
  path: "/";
  maxAge: number;
};

export type IssueOAuthStateInput = {
  /** 認可の後に戻るサイト内のパス。state に入り、照合の後に verifyOAuthState が sanitize して返す */
  redirectAfter: string;
  /** nonce を入れる cookie の名前 (省略 = LINE_OAUTH_NONCE_COOKIE)。流れごとに分ければ同居できる */
  cookieName?: string;
};

export type IssueOAuthStateResult = {
  /** buildAuthorizationUrl の state に渡す値 (base64url の JSON { nonce, redirectAfter }) */
  state: string;
  /** 応答に付ける nonce cookie: response.cookies.set(nonceCookie) */
  nonceCookie: LineOAuthNonceCookie;
};

/** cookie を読む口 (NextRequest の cookies と同じ形。lib は next に依らない) */
export type OAuthStateCookieReader = {
  get(name: string): { value: string } | undefined;
};

export type VerifyOAuthStateInput = {
  /** callback のクエリの state (無ければ null) */
  state: string | null | undefined;
  /** リクエストの cookie (req.cookies) */
  cookies: OAuthStateCookieReader;
  /** issueOAuthState に渡したのと同じ名前 (省略 = LINE_OAUTH_NONCE_COOKIE) */
  cookieName?: string;
};

export type VerifyOAuthStateResult =
  | { ok: true; redirectAfter: string }
  | { ok: false };

/**
 * LINE Login の OAuth を始めるときの state と nonce cookie を作る (CSRF 対策)。
 * nonce = ランダム 16 byte の hex。state に nonce と戻り先を入れ、同じ nonce を httpOnly cookie に置く。
 * callback では verifyOAuthState で照合する。
 */
export function issueOAuthState({
  redirectAfter,
  cookieName = LINE_OAUTH_NONCE_COOKIE,
}: IssueOAuthStateInput): IssueOAuthStateResult {
  const nonce = randomBytes(16).toString("hex");
  const state = Buffer.from(JSON.stringify({ nonce, redirectAfter })).toString("base64url");

  return {
    state,
    nonceCookie: {
      name: cookieName,
      value: nonce,
      httpOnly: true,
      secure: process.env.APP_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: LINE_OAUTH_STATE_MAX_AGE_SECONDS,
    },
  };
}

/**
 * callback の state を cookie の nonce と照合する。
 * - ok: state の nonce と cookie の nonce が一致。redirectAfter は同一オリジンのパスに sanitize 済み (不正なら "/")
 * - ok false: state が無い・壊れている・cookie が無い・不一致。戻り先は信用せず "/" へ戻すこと
 * 照合の後 (成功・失敗とも) 呼び手が nonce cookie を消す (response.cookies.delete(cookieName))。
 */
export function verifyOAuthState({
  state,
  cookies,
  cookieName = LINE_OAUTH_NONCE_COOKIE,
}: VerifyOAuthStateInput): VerifyOAuthStateResult {
  if (!state) return { ok: false };

  let payload: { nonce?: unknown; redirectAfter?: unknown };
  try {
    payload = JSON.parse(Buffer.from(state, "base64url").toString("utf-8"));
  } catch {
    return { ok: false };
  }
  if (!payload || typeof payload !== "object") return { ok: false };

  const stateNonce = typeof payload.nonce === "string" ? payload.nonce : undefined;
  const cookieNonce = cookies.get(cookieName)?.value;
  if (!stateNonce || !cookieNonce || stateNonce !== cookieNonce) {
    return { ok: false };
  }

  return { ok: true, redirectAfter: sanitizeRedirectPath(payload.redirectAfter) };
}
