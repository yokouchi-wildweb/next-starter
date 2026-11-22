import type { NextRequest, NextResponse } from 'next/server';

import type { RedirectToastPayload } from '@/lib/toast';

import type { ProxyUserMap } from './extensions/proxyUser';

// proxies はドメインを値も型も読まない(D22・D30)。利用者の型は点 proxyUser の項目の型(生成された ProxyUserMap)から取り出す

/** proxy が読む Cookie(NextRequest.cookies 相当) */
export type ProxyCookieSource = { get(name: string): { value?: string | null } | undefined };

/**
 * 点 proxyUser の項目(export const plug、ちょうど 1 つ: 上流は常設の auth)。
 * createUser はリクエストごとに 1 回呼ばれ、ctx.user になる解決器(初めて呼ばれたときだけ解き、結果を使い回す)を返す
 */
export type ProxyUserPlug<TUser extends { role: string }> = {
  createUser: (cookies: ProxyCookieSource) => () => Promise<TUser | null>;
};
// 一覧の要素の型(宣言の type。項目の利用者の型は項目ごとなので any で受ける)
export type AnyProxyUserPlug = ProxyUserPlug<any>;

type UserPlug = ProxyUserMap[keyof ProxyUserMap];
/** 利用者(DB 同期、利用可能な status だけ)。上流は auth の SessionUser */
export type ProxyUser = UserPlug extends { createUser: (cookies: never) => () => Promise<infer U> } ? NonNullable<U> : never;
/** 利用者のロール(転送の規則の allowRoles / excludeRoles) */
export type ProxyUserRole = ProxyUser["role"];

/**
 * proxy.ts がリクエストごとに 1 つ作り、全 handler・decorator に渡す文脈。
 *
 * - user(): 利用者(DB 同期)。初めて呼ばれたときだけ解決し、同じリクエストでは結果を使い回す。
 *   利用可能な status の利用者だけ非 null(停止中・休会中・未ログイン・DB 未構成は null)。
 *   解決器は点 proxyUser の項目(上流は auth の plugs/proxyUser/session.ts、API・ページの守りと同じ resolveSessionUser)。
 *   項目は自分でセッションを解かない(lint page-authz/session-api-callsite)。
 */
export type ProxyContext = {
  user: () => Promise<ProxyUser | null>;
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
 * 転送の規則 1 件(点 proxyRedirects の項目 <ドメイン>/plugs/proxyRedirects/<名前>.ts が並べる。読み手は ./redirect.ts)。
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
  allowRoles?: ProxyUserRole[];
  excludeRoles?: ProxyUserRole[];
};

/** 点 proxyRedirects の項目 1 つ = 1 ファイル = 規則の 1 組(`export const redirects: RedirectRuleGroup = [...]`) */
export type RedirectRuleGroup = readonly RedirectRule[];
