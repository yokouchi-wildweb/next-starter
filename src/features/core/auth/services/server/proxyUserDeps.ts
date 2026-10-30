// src/features/core/auth/services/server/proxyUserDeps.ts
//
// proxy(src/proxy.ts)に渡す利用者の解決器。認証の持ち主(auth)がここで 1 つだけ出す。
// API の Factory(apiRouteUserDeps)・ページの守り(pageGuardUserDeps)と同じ resolveSessionUser(DB 同期)を使う。
// 結ぶのは src/proxy.ts(wiring は通さない)。handler・decorator は ctx.user() だけを使い、自分でセッションを解かない
// (lint page-authz/session-api-callsite が src/proxies/** で止める)。
//
// 規則:
// - 遅延: ctx.user() が初めて呼ばれたときだけ解決する(全リクエストで走る proxy で、使わない項目のために DB を引かない)
// - リクエスト内メモ化: 2 回目以降は同じ Promise(React cache は RSC の外では効かないので自前で持つ)
// - 利用可能な status(USER_AVAILABLE_STATUSES)の利用者だけ非 null。停止中・休会中などは null(public の ctx.user と同じ)
// - DB 未構成(isDatabaseConfigured が偽)なら DB を引かず null(UNCONFIGURED_BACKENDS)
// - token だけの版は出さない(役割の判定も DB の現在値で)

import type { SessionUser } from "@/features/core/auth/entities/session";
import { USER_AVAILABLE_STATUSES } from "@/features/core/user/constants";
import type { UserStatus } from "@/features/core/user/types";
import { isDatabaseConfigured } from "@/lib/drizzle";
import { parseSessionCookie } from "@/lib/jwt";

import { resolveSessionUser } from "./session/token";

/** proxy が読む Cookie(NextRequest.cookies 相当) */
export type ProxyCookieSource = { get(name: string): { value?: string | null } | undefined };

/** 解決器の部品(テストで差し替える) */
export type ProxyUserResolverDeps = {
  isConfigured: () => boolean;
  readToken: (cookies: ProxyCookieSource) => string | null;
  resolve: (token: string) => Promise<SessionUser | null>;
  availableStatuses: readonly UserStatus[];
};

const defaultDeps: ProxyUserResolverDeps = {
  isConfigured: isDatabaseConfigured,
  readToken: (cookies) => parseSessionCookie(cookies),
  resolve: resolveSessionUser,
  availableStatuses: USER_AVAILABLE_STATUSES,
};

/** リクエスト 1 つぶんの利用者の解決器(遅延・メモ化)を作る */
export function createProxyUser(
  cookies: ProxyCookieSource,
  deps: ProxyUserResolverDeps = defaultDeps,
): () => Promise<SessionUser | null> {
  let memo: Promise<SessionUser | null> | null = null;

  const load = async (): Promise<SessionUser | null> => {
    if (!deps.isConfigured()) return null;
    const token = deps.readToken(cookies);
    if (!token) return null;
    const user = await deps.resolve(token);
    if (!user) return null;
    return deps.availableStatuses.includes(user.status as UserStatus) ? user : null;
  };

  return () => {
    memo ??= load();
    return memo;
  };
}
