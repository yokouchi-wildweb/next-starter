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

/**
 * 機能を閉じる規則(1 機能 1 ファイル: src/proxies/featureGateRules/<名前>[.<fork ID>].ts の `export const rule`)。
 * enabled() が false の規則は次の 2 か所で効く:
 * - ルートゲート(src/proxies/featureGate.ts): pathPatterns に一致するページ / API を 404(redirectTo があればそこへ rewrite)
 * - スキーマゲート(pnpm db:push / db:push:check、scripts/registry/schemaGate.ts): tables を push 対象から外す
 *   作る方向にしか働かない。false の間は作らず、既にあるテーブルも消さない(true にした次の push で作られる)
 * 一覧は生成物 src/proxies/extensions/featureGateRules.ts(pnpm proxy:generate、ファイル名の順)。読み手はこの一覧だけを読む。
 * 住所の重なりは許す(OR)。行き先の違う重なりは、ファイル名の順で最初の無効な規則の redirectTo(L1.22)。詳細: src/proxies/README.md
 */
export type FeatureGateRule = {
  /**
   * ブロック対象のパス。"/demo" = セグメント境界の前方一致("/demo-login" は含まない)、
   * "=/mypage" = そのパスちょうど(fork が同じ URL の下に足したページを巻き込まない)。照合: src/proxies/pathPattern.mjs
   */
  pathPatterns: string[];
  /** false の間 push 対象から外すテーブル名(pgTable の第 1 引数)。enum は外さない */
  tables?: string[];
  /** この機能が有効か(config の値を読む同期関数。入切の値の置き場は config) */
  enabled: () => boolean;
  /** ブロック時の rewrite 先(省略時: API は 404、ページは /404) */
  redirectTo?: string;
};
