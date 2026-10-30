// src/wiring/apiRoute.ts
//
// API ルートの設定済み Factory 群。lib/routeFactory の汎用版に、利用者の束（auth）・端末の束（pairedDevice）・
// 登録表（serviceRegistry）を結ぶ。src/app/**/route.ts とその補助ファイルはここから import する
// （@/lib/routeFactory の値 import は wiring だけ）。設計: src/wiring/README.md, src/lib/routeFactory/README.md

import { apiRouteUserDeps } from "@/features/core/auth/services/server/apiRouteUserDeps";
import { apiRouteDeviceDeps } from "@/features/core/pairedDevice/services/server/apiRouteDeviceDeps";
import { createRouteFactories } from "@/lib/routeFactory";
import type { PairedDeviceKind } from "@/features/core/pairedDevice/types/kinds";
import { serviceRegistry } from "@/registry/serviceRegistry";

const factories = createRouteFactories<PairedDeviceKind>({
  user: apiRouteUserDeps,
  device: apiRouteDeviceDeps,
  domains: serviceRegistry,
});

/** 全 API ルート共通の Factory（access で認可し、利用者を ctx.user で渡す） */
export const createApiRoute = factories.createApiRoute;
/** 汎用 CRUD（/api/[domain]/**）の Factory（domainEntry.ts の access でドメインごとに認可） */
export const createDomainRoute = factories.createDomainRoute;
/** 汎用 CRUD の id 付きの Factory */
export const createDomainIdRoute = factories.createDomainIdRoute;
/** 本人専用（/api/me/**）の Factory */
export const createMeRoute = factories.createMeRoute;
/** 登録端末を主体にする Factory */
export const createDeviceRoute = factories.createDeviceRoute;
/** ルートの門に加えて掛ける追加の門（主体は ctx.user を渡す） */
export const enforceAccessRule = factories.enforceAccessRule;

export { ownerWhere } from "@/lib/routeFactory";
export type {
  AccessDenialContext,
  ApiRouteConfig,
  ApiRouteContext,
  ApiRouteHandler,
  ApiRouteUser,
  DeviceOrUserRouteConfig,
  DeviceOrUserRouteHandler,
  DevicePrincipalContext,
  DeviceRouteConfig,
  DeviceRouteHandler,
  DomainRouteConfig,
  DomainRouteContext,
  EnforceAccessOptions,
  MeRouteConfig,
  MeRouteContext,
  MeRouteHandler,
  OperationType,
  RouteAccess,
  UserPrincipalContext,
} from "@/lib/routeFactory";
