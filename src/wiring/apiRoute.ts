// src/wiring/apiRoute.ts
//
// API ルートの設定済み Factory 群。lib/routeFactory の汎用版に、利用者の束（auth）・レート制限の束（rateLimit）・端末の束（pairedDevice）・
// 登録表（serviceRegistry）を結ぶ。src/app/**/route.ts とその補助ファイルはここから import する
// （@/lib/routeFactory の値 import は wiring だけ）。設計: src/wiring/README.md, src/lib/routeFactory/README.md

import type { SessionUser } from "@/features/core/auth/entities/session";
import { apiRouteUserDeps } from "@/features/core/auth/services/server/apiRouteUserDeps";
import { apiRouteDeviceDeps } from "@/features/core/pairedDevice/services/server/apiRouteDeviceDeps";
import type { AuthenticatedDevice } from "@/features/core/pairedDevice/services/server/deviceToken";
import type { SessionDeviceOf } from "@/features/core/pairedDevice/services/server/session";
import type { PairedDeviceKind } from "@/features/core/pairedDevice/types/kinds";
import { apiRouteRateLimitDeps } from "@/features/core/rateLimit/services/server/apiRouteRateLimitDeps";
import type { UserStatus } from "@/features/core/user/types";
import { createRouteFactories } from "@/lib/routeFactory";
import type {
  ApiRouteConfig as GenericApiRouteConfig,
  ApiRouteContext as GenericApiRouteContext,
  ApiRouteHandler as GenericApiRouteHandler,
  ApiRouteUser as GenericApiRouteUser,
  DeviceOrUserRouteConfig as GenericDeviceOrUserRouteConfig,
  DeviceOrUserRouteHandler as GenericDeviceOrUserRouteHandler,
  DevicePrincipalContext as GenericDevicePrincipalContext,
  DeviceRouteHandler as GenericDeviceRouteHandler,
  DomainRouteConfig as GenericDomainRouteConfig,
  DomainRouteContext as GenericDomainRouteContext,
  EnforceAccessOptions as GenericEnforceAccessOptions,
  MeRouteConfig as GenericMeRouteConfig,
  MeRouteContext as GenericMeRouteContext,
  MeRouteHandler as GenericMeRouteHandler,
  RouteAccess,
  UserPrincipalContext as GenericUserPrincipalContext,
} from "@/lib/routeFactory";
import { serviceRegistry } from "@/registry/serviceRegistry";

/** 端末の種類 → ハンドラに渡す端末の型 */
type DevicesByKind = { [K in PairedDeviceKind]: SessionDeviceOf<K> };

const factories = createRouteFactories<DevicesByKind, SessionUser, UserStatus, AuthenticatedDevice>({
  user: apiRouteUserDeps,
  device: apiRouteDeviceDeps,
  rateLimit: apiRouteRateLimitDeps,
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
  DeviceRouteConfig,
  OperationType,
  RouteAccess,
} from "@/lib/routeFactory";

// 汎用の型を主体の具体の型で結んだもの
export type ApiRouteUser<A extends RouteAccess = RouteAccess> = GenericApiRouteUser<A, SessionUser>;
export type ApiRouteConfig<A extends RouteAccess = RouteAccess> = GenericApiRouteConfig<A, UserStatus>;
export type ApiRouteContext<TParams = Record<string, string>, TUser = SessionUser | null> = GenericApiRouteContext<TParams, TUser>;
export type ApiRouteHandler<TParams = Record<string, string>, TResult = unknown, TUser = SessionUser | null> = GenericApiRouteHandler<TParams, TResult, TUser>;
export type DomainRouteConfig<TService> = GenericDomainRouteConfig<TService, UserStatus>;
export type DomainRouteContext<TService, TParams> = GenericDomainRouteContext<TService, TParams, SessionUser>;
export type EnforceAccessOptions = GenericEnforceAccessOptions<UserStatus>;
export type MeRouteConfig = GenericMeRouteConfig<UserStatus>;
export type MeRouteContext<TParams = Record<string, string>> = GenericMeRouteContext<TParams, SessionUser>;
export type MeRouteHandler<TParams = Record<string, string>, TResult = unknown> = GenericMeRouteHandler<TParams, TResult, SessionUser>;
export type DeviceOrUserRouteConfig<K extends string> = GenericDeviceOrUserRouteConfig<K, UserStatus>;
export type DevicePrincipalContext<K extends PairedDeviceKind, TParams> = GenericDevicePrincipalContext<SessionDeviceOf<K>, TParams>;
export type UserPrincipalContext<TParams> = GenericUserPrincipalContext<TParams, SessionUser>;
export type DeviceRouteHandler<K extends PairedDeviceKind, TParams, TResult> = GenericDeviceRouteHandler<SessionDeviceOf<K>, TParams, TResult>;
export type DeviceOrUserRouteHandler<K extends PairedDeviceKind, TParams, TResult> = GenericDeviceOrUserRouteHandler<SessionDeviceOf<K>, TParams, TResult, SessionUser>;
