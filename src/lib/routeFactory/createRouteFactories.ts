// src/lib/routeFactory/createRouteFactories.ts
//
// 汎用の Factory 群を、差し込む束（利用者・端末・登録表）と結んで作る。
// 呼ぶのは src/wiring/apiRoute.ts だけ（route は wiring の設定済み版を import する）。

import { makeCreateApiRoute, makeRouteCore } from "./createApiRoute";
import { makeCreateDeviceRoute } from "./createDeviceRoute";
import { makeDomainRoutes } from "./createDomainRoute";
import { makeCreateMeRoute } from "./createMeRoute";
import type { RouteAuthenticatedDevice, RouteFactoryDeps, RouteUserBase } from "./deps";
import { makeEnforceAccessRule } from "./enforceAccess";

/**
 * API ルートの Factory 群を作る。
 * - TDevices: 端末の種類 → ハンドラに渡す端末の型 / TUser・TStatus: 利用者と status / TAuthenticated: 認証済みの端末 /
 *   TCategory: レート制限のカテゴリの名前（全部 wiring が具体の型を渡す。lib は features の型を読まない）
 * - 主体はリクエストごとに 1 回だけ deps.user.resolveUser で解き、全 access で ctx.user に渡す
 */
export function createRouteFactories<
  TDevices extends Record<string, unknown>,
  TUser extends RouteUserBase<TStatus>,
  TStatus extends string,
  TAuthenticated extends RouteAuthenticatedDevice,
  TCategory extends string = string,
>(deps: RouteFactoryDeps<TUser, TStatus, TAuthenticated, TCategory>) {
  const runRoute = makeRouteCore<TCategory>(deps.user, deps.rateLimit, deps.gate);
  const createApiRoute = makeCreateApiRoute<TUser, TStatus, TCategory>(deps.user, runRoute);
  const { createDomainRoute, createDomainIdRoute } = makeDomainRoutes<TUser, TStatus, TCategory>(deps.user, deps.domains, runRoute);
  const createMeRoute = makeCreateMeRoute(createApiRoute);
  const createDeviceRoute = makeCreateDeviceRoute<TDevices, TUser, TStatus, TAuthenticated, TCategory>(deps.user, deps.device, runRoute);
  const enforceAccessRule = makeEnforceAccessRule(deps.user);

  return {
    createApiRoute,
    createDomainRoute,
    createDomainIdRoute,
    createMeRoute,
    createDeviceRoute,
    enforceAccessRule,
  };
}

export type RouteFactories<
  TDevices extends Record<string, unknown>,
  TUser extends RouteUserBase<TStatus>,
  TStatus extends string,
  TAuthenticated extends RouteAuthenticatedDevice,
  TCategory extends string = string,
> = ReturnType<typeof createRouteFactories<TDevices, TUser, TStatus, TAuthenticated, TCategory>>;
