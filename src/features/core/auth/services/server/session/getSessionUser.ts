// src/features/auth/services/server/session/getSessionUser.ts

import { cache } from "react";
import { cookies } from "next/headers";

import { parseSessionCookie } from "@/lib/jwt";
import type { SessionUser } from "@/features/core/auth/entities/session";
import { resolveSessionUserOutcome, type SessionUserOutcome } from "./token";

/**
 * 現在のリクエスト Cookie からセッションの利用者を DB で確かめた結果（障害を「利用者なし」と区別する）。
 *
 * React `cache()` でラップしているため、同一サーバーリクエスト内の重複呼び出しは
 * 1 回の DB 引きに圧縮される (例: AuthSessionProvider + guard.ts の guard() + 各ページの
 * getSessionUser + API の Factory が同居しても DB クエリは 1 回)。
 * getSessionUser と getSessionUserForRoute はこの 1 つの結果を共有する。
 */
const getSessionUserOutcome = cache(async (): Promise<SessionUserOutcome> => {
  const cookieStore = await cookies();
  const token = parseSessionCookie(cookieStore);

  if (!token) {
    return { user: null };
  }

  return resolveSessionUserOutcome(token);
});

/**
 * 現在のリクエスト Cookie からセッションユーザーを取得する。
 *
 * 戻り値の status / role / isDemo / name 等は DB の現在値が反映される
 * (JWT のクレームは userId の証明にのみ使われる)。
 * 管理画面でステータス変更が行われた場合も次回リクエストで即時反映される。
 * DB アクセス障害も null（ページの守りはログインへ送る。整合性を優先）。
 */
export const getSessionUser = async (): Promise<SessionUser | null> => {
  const outcome = await getSessionUserOutcome();
  return outcome.unavailable ? null : outcome.user;
};

/** DB 障害でセッションの利用者を確かめられない（getSessionUserForRoute が投げる） */
export class SessionUserUnavailableError extends Error {
  constructor(cause: unknown) {
    super("session user could not be verified (database unavailable)");
    this.name = "SessionUserUnavailableError";
    (this as { cause?: unknown }).cause = cause;
  }
}

/**
 * API の Factory 用（apiRouteUserDeps.resolveUser）。getSessionUser と同じ 1 回の引きを使い、
 * null = 利用者なし（未ログイン・失効）、DB 障害 = SessionUserUnavailableError を throw。
 * Factory（lib/routeFactory）は throw を 503（code "route_user_unavailable"）にする。route・業務コードは直接使わない
 */
export const getSessionUserForRoute = async (): Promise<SessionUser | null> => {
  const outcome = await getSessionUserOutcome();
  if (outcome.unavailable) throw new SessionUserUnavailableError(outcome.error);
  return outcome.user;
};
