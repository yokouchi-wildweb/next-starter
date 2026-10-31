// src/lib/routeFactory/index.ts
// 汎用版。値を import してよいのは src/wiring/** だけ（route は @/wiring/apiRoute の設定済み版を使う）。型は誰でも可

export { createRouteFactories, type RouteFactories } from "./createRouteFactories";
export type {
  RouteAccessDecision,
  RouteAuthenticatedDevice,
  RouteDeviceDeps,
  RouteFactoryDeps,
  RouteRateLimitDeps,
  RouteRateLimitResult,
  RouteUserBase,
  RouteUserDeps,
} from "./deps";
export {
  type ApiRouteBaseConfig,
  type ApiRouteConfig,
  type ApiRouteContext,
  type ApiRouteHandler,
  type ApiRouteUser,
  type NextRouteHandler,
  type OperationType,
  type RecaptchaConfig,
  type RouteAccess,
} from "./createApiRoute";
export type { AccessDenialContext, EnforceAccessOptions, EnforceAccessRule } from "./enforceAccess";
export {
  type DomainRouteConfig,
  type DomainRouteContext,
} from "./createDomainRoute";
export {
  ownerWhere,
  type MeRouteConfig,
  type MeRouteContext,
  type MeRouteHandler,
} from "./createMeRoute";
export {
  type DeviceRouteConfig,
  type DeviceOrUserRouteConfig,
  type DeviceRouteHandler,
  type DeviceOrUserRouteHandler,
  type DevicePrincipalContext,
  type UserPrincipalContext,
} from "./createDeviceRoute";
