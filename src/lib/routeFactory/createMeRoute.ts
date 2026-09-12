// src/lib/routeFactory/createMeRoute.ts
//
// 認証済みユーザー専用ルート（/api/me/**）のファクトリー。
//
// createApiRoute をラップし、認証を強制した上で「認証済みユーザー」をハンドラに渡す。
// これにより /api/me 配下の各ルートで `if (!session) ...` を書く必要がなくなり、
// 認証が構造的に保証される。
//
// オーナーシップ（自分のデータのみ）は ctx.user.userId を where 等に必ず使って実現する。
// 汎用 /api/[domain] はクライアント指定の user_id を信用してしまうため、ユーザー所有データは
// このファクトリーで提供する専用ルートに集約する。

import { NextRequest } from "next/server";

import type { SessionUser } from "@/features/core/auth/entities/session";
import { requireAuthenticated } from "@/features/core/auth/services/server/requireRole";
import type { UserStatus } from "@/features/core/user/types";
import type { WhereExpr } from "@/lib/crud";

import { createApiRoute, type ApiRouteConfig, type ApiRouteContext } from "./createApiRoute";

/** /api/me/** 用のハンドラーコンテキスト。認証済みユーザーを必ず含む。 */
export type MeRouteContext<TParams = Record<string, string>> = ApiRouteContext<TParams> & {
  /** 認証済みユーザー（DB 同期）。未認証なら factory が 401 で弾くため常に存在する。 */
  user: SessionUser;
};

export type MeRouteHandler<TParams = Record<string, string>, TResult = unknown> = (
  req: NextRequest,
  ctx: MeRouteContext<TParams>,
) => Promise<TResult>;

export type MeRouteConfig = Omit<ApiRouteConfig, "access"> & {
  /**
   * 通過を許可するユーザーステータス。省略時は USER_AVAILABLE_STATUSES（active のみ = 現行動作）。
   * 「利用制限中でも本人が完了すべき手続き」（不正疑いチャレンジの回答・異議申立て・
   * 再有効化・KYC 等）のルートでのみ suspended 等を明示列挙する。
   * fail-closed: 列挙していないステータスは常に 403。authGuard の allowStatuses と同じ語彙。
   */
  allowStatuses?: readonly UserStatus[];
};

/**
 * 認証済みユーザー専用ルートのファクトリー。
 * - 認証を強制（未認証→401 / 利用停止→403）
 * - ハンドラに認証済み user（DB 同期）を渡す
 *
 * access は固定（認証は createMeRoute 自身が requireAuthenticated で行う）のため、
 * config では受け取らない。
 */
export function createMeRoute<TParams = Record<string, string>, TResult = unknown>(
  config: MeRouteConfig,
  handler: MeRouteHandler<TParams, TResult>,
) {
  const { allowStatuses, ...apiConfig } = config;
  return createApiRoute<TParams, TResult>(
    { ...apiConfig, access: "custom" },
    async (req, ctx) => {
      const user = await requireAuthenticated({ allowStatuses });
      return handler(req, { ...ctx, user });
    },
  );
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
export function ownerWhere(user: SessionUser, field = "user_id"): WhereExpr {
  return { field, op: "eq", value: user.userId };
}
