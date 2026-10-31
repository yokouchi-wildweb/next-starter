// src/lib/routeFactory/createMeRoute.ts
//
// 認証済みユーザー専用ルート（/api/me/**）のファクトリー。
//
// createApiRoute（access "authenticated"）をラップし、認証を強制した上で「認証済みユーザー」をハンドラに渡す。
// これにより /api/me 配下の各ルートで `if (!session) ...` を書く必要がなくなり、
// 認証が構造的に保証される。
//
// オーナーシップ（自分のデータのみ）は ctx.user.userId を where 等に必ず使って実現する。
// 汎用 /api/[domain] はクライアント指定の user_id を信用してしまうため、ユーザー所有データは
// このファクトリーで提供する専用ルートに集約する。

import { NextRequest } from "next/server";

import type { WhereExpr } from "@/lib/crud";

import type { ApiRouteBaseConfig, ApiRouteContext, CreateApiRoute } from "./createApiRoute";
import type { RouteUserBase } from "./deps";

/** /api/me/** 用のハンドラーコンテキスト。認証済みユーザー（DB 同期）を必ず含む。 */
export type MeRouteContext<TParams = Record<string, string>, TUser = RouteUserBase> = ApiRouteContext<TParams, TUser>;

export type MeRouteHandler<TParams = Record<string, string>, TResult = unknown, TUser = RouteUserBase> = (
  req: NextRequest,
  ctx: MeRouteContext<TParams, TUser>,
) => Promise<TResult>;

export type MeRouteConfig<TStatus extends string = string> = ApiRouteBaseConfig & {
  /**
   * 通過を許可するユーザーステータス。省略時は USER_AVAILABLE_STATUSES（active のみ = 現行動作）。
   * 「利用制限中でも本人が完了すべき手続き」（不正疑いチャレンジの回答・異議申立て・
   * 再有効化・KYC 等）のルートでのみ suspended 等を明示列挙する。
   * fail-closed: 列挙していないステータスは常に 403。ページの守り(guard.ts)の allowStatuses と同じ語彙。
   */
  allowStatuses?: readonly TStatus[];
};

/**
 * 認証済みユーザー専用ルートのファクトリーを作る。
 * - 認証を強制（未認証→401 / 利用停止→403）
 * - ハンドラに認証済み user（DB 同期）を渡す
 *
 * access は固定（"authenticated"）のため、config では受け取らない。
 */
export function makeCreateMeRoute<TUser extends RouteUserBase<TStatus>, TStatus extends string>(
  createApiRoute: CreateApiRoute<TUser, TStatus>,
) {
  return function createMeRoute<TParams = Record<string, string>, TResult = unknown>(
    config: MeRouteConfig<TStatus>,
    handler: MeRouteHandler<TParams, TResult, TUser>,
  ) {
    return createApiRoute<TParams, TResult, "authenticated">({ ...config, access: "authenticated" }, handler);
  };
}

/**
 * 認証済みユーザー本人のレコードに絞る where 式を返す。
 * createMeRoute の ctx.user と組み合わせ、オーナーシップを所有者カラムで固定する。
 *
 * @example
 *   const result = await service.search({ where: ownerWhere(user) });
 *
 * @param user createMeRoute が渡す認証済みユーザー
 * @param field 所有者カラム名（既定: "user_id"）
 */
export function ownerWhere(user: Pick<RouteUserBase, "userId">, field = "user_id"): WhereExpr {
  return { field, op: "eq", value: user.userId };
}
