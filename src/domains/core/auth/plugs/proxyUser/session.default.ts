// src/domains/core/auth/plugs/proxyUser/session.default.ts
//
// 点 proxyUser(proxy の利用者の解き方、ちょうど 1 つ、宣言 src/proxies/extensionPoints.ts)に差す上流の既定。常設の auth が差す(D53)。
// 呼び手は隣の 1 行スイッチ ./session.ts(fork は差替点 authProxyUser で ./session.replace.ts に替える)。src/proxy.ts が生成された一覧ごしに
// リクエストごとに createUser を呼び、ctx.user にする。API の Factory(点 routeFactoryUser の項目 ../routeFactoryUser/session.default.ts)・
// ページの守り(点 pageGuardUser の項目)と同じ resolveSessionUser(DB 同期)を使う。handler・decorator は ctx.user() だけを使い、自分でセッションを解かない
// (lint page-authz/session-api-callsite が src/proxies/** で止める)。
//
// 規則:
// - 遅延: ctx.user() が初めて呼ばれたときだけ解決する(全リクエストで走る proxy で、使わない項目のために DB を引かない)
// - リクエスト内メモ化: 2 回目以降は同じ Promise(React cache は RSC の外では効かないので自前で持つ)
// - 利用可能な status(USER_AVAILABLE_STATUSES)の利用者だけ非 null。停止中・休会中などは null(public の ctx.user と同じ)
// - DB 未構成(isDatabaseConfigured が偽)なら DB を引かず null(CLAUDE.md BACKENDS unconfigured)
// - token だけの版は出さない(役割の判定も DB の現在値で)

import type { SessionUser } from "@/domains/core/auth/entities/session";
import { USER_AVAILABLE_STATUSES } from "@/domains/core/user/constants";
import type { UserStatus } from "@/domains/core/user/types";
import { isDatabaseConfigured } from "@/lib/drizzle";
import { parseSessionCookie } from "@/lib/jwt";


import { resolveSessionUser } from "../../services/server/session/token";
import type { ProxyCookieSource, ProxyUserPlug } from "@/proxies/points";

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

export const plug: ProxyUserPlug<SessionUser> = {
  createUser: (cookies) => createProxyUser(cookies),
};
