import type { NextRequest, NextResponse } from 'next/server';

import type { SessionUser } from '@/features/core/auth/entities/session';
import type { UserRoleType } from '@/features/core/user/types';
import type { RedirectToastPayload } from '@/lib/toast';

/**
 * proxy.ts がリクエストごとに 1 つ作り、全 handler・decorator に渡す文脈。
 *
 * - user(): 利用者(DB 同期)。初めて呼ばれたときだけ解決し、同じリクエストでは結果を使い回す。
 *   利用可能な status の利用者だけ非 null(停止中・休会中・未ログイン・DB 未構成は null)。
 *   解決器は features/core/auth の createProxyUser(API・ページの守りと同じ resolveSessionUser)。
 *   項目は自分でセッションを解かない(lint page-authz/session-api-callsite)。
 */
export type ProxyContext = {
  user: () => Promise<SessionUser | null>;
};

export type ProxyResult = Response | void | Promise<Response | void>;
export type ProxyHandler = (request: NextRequest, ctx: ProxyContext) => ProxyResult;

/**
 * リクエストを素通しさせつつ、最終レスポンス（NextResponse.next()）に
 * cookie 付与などの副作用を加えるためのデコレーター。
 *
 * ProxyHandler がインターセプト（Response を返却 = チェーン打ち切り）した場合は
 * 実行されない点に注意（リダイレクト・メンテナンス応答等ではスキップされる）。
 */
export type ProxyResponseDecorator = (
  request: NextRequest,
  response: NextResponse,
  ctx: ProxyContext,
) => void | Promise<void>;

/**
 * 転送の規則 1 件(受け口 src/proxies/redirects/<名前>.ts の項目が並べる。読み手は ./redirect.ts)。
 *
 * 条件の優先順
 * 1. `authedOnly`: true の場合はログイン済みユーザーのみ対象（デフォルト true）
 * 2. `guestOnly`: true の場合は未ログイン限定（ログイン済みなら即リダイレクト）
 * 3. `allowRoles`: 指定ロールのみに絞り込み（ホワイトリスト）
 * 4. `excludeRoles`: 指定ロールを除外（ブラックリスト）
 *
 * 上記は必要なものだけを指定する。
 * !! `authedOnly` と `guestOnly` を同時に true にしないこと。
 * `toast` を省略するとトーストなしの純粋なリダイレクトになる。
 */
export type RedirectRule = {
  sourcePaths: string[];
  destination: string;
  toast?: RedirectToastPayload;
  authedOnly?: boolean;
  guestOnly?: boolean;
  allowRoles?: UserRoleType[];
  excludeRoles?: UserRoleType[];
};

/** 受け口 redirects の項目 1 つ = 1 ファイル = 規則の 1 組(`export const redirects: RedirectRuleGroup = [...]`) */
export type RedirectRuleGroup = readonly RedirectRule[];
