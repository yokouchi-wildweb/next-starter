// src/wiring/apiRoute.ts
//
// API ルートの設定済み Factory 群。lib/routeFactory の汎用版に、点 routeFactoryUser・routeFactoryRateLimit・routeFactoryDevice の項目
// (生成された一覧 src/wiring/routeFactory.ts、門番 gate.plugs で閉じたドメインの項目を外す)・登録表（serviceRegistry）・
// 門番（@/featureGate の gate.path）・メンテナンスの判定(点 routeFactoryMaintenance の項目、上流は setting)を結ぶ。src/app/**/route.ts とその補助ファイルはここから import する
// （@/lib/routeFactory の値 import は wiring だけ）。利用者・端末・カテゴリの具体の型は一覧の <点>Map の型から取り出す(ドメインを読まない、D22)。
// 設計: src/wiring/README.md, src/lib/routeFactory/README.md

import { gate } from "@/featureGate";
import { createRouteFactories } from "@/lib/routeFactory";
import { serverErrorReport } from "@/wiring/serverErrorReport";
import type {
  ApiRouteConfig as GenericApiRouteConfig,
  ApiRouteContext as GenericApiRouteContext,
  ApiRouteHandler as GenericApiRouteHandler,
  ApiRouteUser as GenericApiRouteUser,
  AuthenticatedDeviceOf,
  CategoryOf,
  DeviceKindOf,
  DeviceOfKind,
  DeviceOrUserRouteConfig as GenericDeviceOrUserRouteConfig,
  DeviceRouteConfig as GenericDeviceRouteConfig,
  DeviceOrUserRouteHandler as GenericDeviceOrUserRouteHandler,
  DevicePrincipalContext as GenericDevicePrincipalContext,
  DeviceRouteHandler as GenericDeviceRouteHandler,
  DevicesOf,
  DomainRouteConfig as GenericDomainRouteConfig,
  DomainRouteContext as GenericDomainRouteContext,
  EnforceAccessOptions as GenericEnforceAccessOptions,
  MeRouteConfig as GenericMeRouteConfig,
  MeRouteContext as GenericMeRouteContext,
  MeRouteHandler as GenericMeRouteHandler,
  PlugOfMap,
  RouteAccess,
  StatusOf,
  UserOf,
  UserPrincipalContext as GenericUserPrincipalContext,
} from "@/lib/routeFactory";
import { serviceRegistry } from "@/registry/serviceRegistry";
import {
  routeFactoryDevice,
  routeFactoryMaintenance,
  routeFactoryRateLimit,
  routeFactoryUser,
  type RouteFactoryDeviceMap,
  type RouteFactoryMaintenanceMap,
  type RouteFactoryRateLimitMap,
  type RouteFactoryUserMap,
} from "@/wiring/routeFactory";

// 項目の具体の型(項目が無い点は never。利用者・レート制限は required で必ず 1 つ)
type UserPlug = PlugOfMap<RouteFactoryUserMap>;
type RateLimitPlug = PlugOfMap<RouteFactoryRateLimitMap>;
type DevicePlug = PlugOfMap<RouteFactoryDeviceMap>;
type MaintenancePlug = PlugOfMap<RouteFactoryMaintenanceMap>;

type SessionUser = UserOf<UserPlug>;
type UserStatus = StatusOf<UserPlug>;
/** レート制限のカテゴリの名前(持ち主 domains/core/rateLimit の config の型、項目の型から取り出す) */
export type RateLimitCategory = CategoryOf<RateLimitPlug>;
type AuthenticatedDevice = AuthenticatedDeviceOf<DevicePlug>;
/** 登録端末の種類(端末の項目が無ければ never) */
type PairedDeviceKind = DeviceKindOf<DevicePlug>;
/** 種類 K で絞った端末の型(K が never = 絞らない端末) */
type SessionDeviceOf<K extends string> = DeviceOfKind<DevicePlug, K>;
/** 端末の種類 → ハンドラに渡す端末の型 */
type DevicesByKind = DevicesOf<DevicePlug>;

/** ちょうど 1 つの点の項目(生成の検査が 0 個・2 個以上を止める。閉じないドメインの項目なので門番で外れない) */
function onlyPlug<P>(entries: readonly { plug: unknown }[], point: string): P {
  const [entry] = entries;
  if (!entry) throw new Error(`${point}: 項目がありません(常設のドメインの項目がちょうど 1 つ要る。pnpm generate extensions)`);
  return entry.plug as P;
}

const userPlug = onlyPlug<UserPlug>(gate.plugs(routeFactoryUser), "routeFactoryUser");
const rateLimitPlug = onlyPlug<RateLimitPlug>(gate.plugs(routeFactoryRateLimit), "routeFactoryRateLimit");
// 端末の項目を差したドメイン(pairedDevice)が閉じている間は門番が項目を外し、lib の「端末なし」で動く(端末だけのルートは 401、orUser は利用者の枝、D53)
const devicePlug = gate.plugs(routeFactoryDevice)[0]?.plug as DevicePlug | undefined;
// メンテナンスの判定(0〜1 個)。空ならメンテナンスで止めない
const maintenancePlug = gate.plugs(routeFactoryMaintenance)[0]?.plug as MaintenancePlug | undefined;

// 主体の具体の型は項目の型から渡す(lib は domains の型を読まない、L1.25)
const factories = createRouteFactories<DevicesByKind, SessionUser, UserStatus, AuthenticatedDevice, RateLimitCategory>({
  user: userPlug.deps,
  ...(devicePlug ? { device: devicePlug.deps } : {}),
  rateLimit: rateLimitPlug.deps,
  domains: serviceRegistry,
  // 門番: 閉じた機能の住所の API は Factory も 404（proxy の 404 の安全網、D19）
  gate: { isClosed: (pathname) => !gate.path(pathname).open },
  // メンテナンス: 期間中の書き込みのメソッドを止める。判定は画面の proxy と同じ持ち主(setting)の項目。
  // 通す経路はルートが maintenance: "pass" で宣言する(src/lib/routeFactory/README.md)
  ...(maintenancePlug ? { maintenance: maintenancePlug.deps } : {}),
  // 想定外の失敗(500)はサーバーの失敗の記録へ(既定の 1 行 + fork の送り先。src/lib/serverErrorReport/README.md)
  serverError: {
    onServerError: (error, input) =>
      serverErrorReport.report(error, {
        scope: "api",
        path: input.path,
        method: input.method,
        headers: input.headers,
        requestId: input.requestId,
        name: input.operation,
      }),
  },
});

/** 全 API ルート共通の Factory（access で認可し、利用者を ctx.user で渡す） */
export const createApiRoute = factories.createApiRoute;
/** 汎用 CRUD（/api/[domain]/**）の Factory（登録表の access でドメインごとに認可） */
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
  OperationType,
  RouteAccess,
} from "@/lib/routeFactory";

// 汎用の型を主体の具体の型で結んだもの
export type ApiRouteUser<A extends RouteAccess = RouteAccess> = GenericApiRouteUser<A, SessionUser>;
export type ApiRouteConfig<A extends RouteAccess = RouteAccess> = GenericApiRouteConfig<A, UserStatus, RateLimitCategory>;
export type ApiRouteContext<TParams = Record<string, string>, TUser = SessionUser | null> = GenericApiRouteContext<TParams, TUser>;
export type ApiRouteHandler<TParams = Record<string, string>, TResult = unknown, TUser = SessionUser | null> = GenericApiRouteHandler<TParams, TResult, TUser>;
export type DomainRouteConfig<TService> = GenericDomainRouteConfig<TService, UserStatus>;
export type DomainRouteContext<TService, TParams> = GenericDomainRouteContext<TService, TParams, SessionUser>;
export type EnforceAccessOptions = GenericEnforceAccessOptions<UserStatus>;
export type MeRouteConfig = GenericMeRouteConfig<UserStatus, RateLimitCategory>;
export type MeRouteContext<TParams = Record<string, string>> = GenericMeRouteContext<TParams, SessionUser>;
export type MeRouteHandler<TParams = Record<string, string>, TResult = unknown> = GenericMeRouteHandler<TParams, TResult, SessionUser>;
export type DeviceRouteConfig<K extends string> = GenericDeviceRouteConfig<K, RateLimitCategory>;
export type DeviceOrUserRouteConfig<K extends string> = GenericDeviceOrUserRouteConfig<K, UserStatus, RateLimitCategory>;
export type DevicePrincipalContext<K extends PairedDeviceKind, TParams> = GenericDevicePrincipalContext<SessionDeviceOf<K>, TParams>;
export type UserPrincipalContext<TParams> = GenericUserPrincipalContext<TParams, SessionUser>;
export type DeviceRouteHandler<K extends PairedDeviceKind, TParams, TResult> = GenericDeviceRouteHandler<SessionDeviceOf<K>, TParams, TResult>;
export type DeviceOrUserRouteHandler<K extends PairedDeviceKind, TParams, TResult> = GenericDeviceOrUserRouteHandler<SessionDeviceOf<K>, TParams, TResult, SessionUser>;
