// src/features/auth/services/server/session/getSessionUser.ts

import { cache } from "react";
import { cookies } from "next/headers";

import { parseSessionCookie } from "@/lib/jwt";
import type { SessionUser } from "@/features/core/auth/entities/session";
import { resolveSessionUser } from "./token";

/**
 * 現在のリクエスト Cookie からセッションユーザーを取得する。
 *
 * 戻り値の status / role / isDemo / name 等は resolveSessionUser を経由して
 * DB の現在値が反映される (JWT のクレームは userId の証明にのみ使われる)。
 * 管理画面でステータス変更が行われた場合も次回リクエストで即時反映される。
 *
 * React `cache()` でラップしているため、同一サーバーリクエスト内の重複呼び出しは
 * 1 回の DB 引きに圧縮される (例: AuthSessionProvider + authGuard + 各ページの
 * getSessionUser が同居しても DB クエリは 1 回)。
 */
export const getSessionUser = cache(async (): Promise<SessionUser | null> => {
  const cookieStore = await cookies();
  const token = parseSessionCookie(cookieStore);

  if (!token) {
    return null;
  }

  return resolveSessionUser(token);
});
