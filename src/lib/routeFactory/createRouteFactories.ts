// src/lib/routeFactory/createRouteFactories.ts
//
// 汎用の Factory 群を、差し込む束（利用者・端末・登録表）と結んで作る。
// 呼ぶのは src/wiring/apiRoute.ts だけ（route は wiring の設定済み版を import する）。

import type { AuthenticatedDevice } from "@/features/core/pairedDevice/services/server/deviceToken";

import { makeCreateApiRoute, makeRouteCore } from "./createApiRoute";
import { makeCreateDeviceRoute } from "./createDeviceRoute";
import { makeDomainRoutes } from "./createDomainRoute";
import { makeCreateMeRoute } from "./createMeRoute";
import type { RouteFactoryDeps } from "./deps";
import { makeEnforceAccessRule } from "./enforceAccess";

/**
 * API ルートの Factory 群を作る。
 * - TDeviceKind: 登録済みの端末の種類（wiring が pairedDeviceKindRegistry の型を渡す）
 * - 主体はリクエストごとに 1 回だけ deps.user.resolveUser で解き、全 access で ctx.user に渡す
 */
export function createRouteFactories<TDeviceKind extends string>(
  deps: RouteFactoryDeps<AuthenticatedDevice>,
) {
  const runRoute = makeRouteCore(deps.user);
  const createApiRoute = makeCreateApiRoute(deps.user, runRoute);
  const { createDomainRoute, createDomainIdRoute } = makeDomainRoutes(deps.user, deps.domains, runRoute);
  const createMeRoute = makeCreateMeRoute(createApiRoute);
  const createDeviceRoute = makeCreateDeviceRoute<TDeviceKind>(deps.user, deps.device, runRoute);
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

export type RouteFactories<TDeviceKind extends string = string> = ReturnType<
  typeof createRouteFactories<TDeviceKind>
>;
