import type { NextRequest, NextResponse } from 'next/server';

import type { SessionUser } from '@/features/core/auth/entities/session';

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
