// src/lib/routeFactory/plugs.ts
//
// API ルートの Factory の 3 つの点(./extensionPoints.ts)の約束の型と、生成された一覧の項目の型から具体の型を取り出す型。値は持たない。
// 点: routeFactoryUser(利用者の解き方、ちょうど 1 つ: 常設の auth が既定を差す)/ routeFactoryRateLimit(レート制限、ちょうど 1 つ: 常設の rateLimit)/
// routeFactoryDevice(登録端末、0〜1 個: 閉じられる pairedDevice が差す。空なら lib の「端末なし」、D53)/
// routeFactoryMaintenance(メンテナンスの判定、0〜1 個: 上流は setting が差す。空ならメンテナンスで止めない)。
// 項目の具体の型(利用者・status・カテゴリ・端末)は項目の値の型に残り、wiring は生成された <点>Map の型から取り出す(wiring はドメインを読まない、D22)

import type { RouteAuthenticatedDevice, RouteDeviceDeps, RouteMaintenanceDeps, RouteRateLimitDeps, RouteUserBase, RouteUserDeps } from "./deps";

/** 点 routeFactoryUser の項目(export const plug) */
export type RouteUserPlug<TUser extends RouteUserBase<TStatus>, TStatus extends string> = {
  deps: RouteUserDeps<TUser, TStatus>;
};

/** 点 routeFactoryRateLimit の項目(TCategory = レート制限のカテゴリの名前) */
export type RouteRateLimitPlug<TCategory extends string> = {
  deps: RouteRateLimitDeps<TCategory>;
};

/** 点 routeFactoryMaintenance の項目(TUser = バイパスを判定する利用者の型。点 routeFactoryUser の利用者と同じ型を渡す) */
export type RouteMaintenancePlug<TUser> = {
  deps: RouteMaintenanceDeps<TUser>;
};

/**
 * 点 routeFactoryDevice の項目。TDevices(端末の種類 → ハンドラに渡す端末の型)と TAnyDevice(種類で絞らない端末)は
 * 値を持たない型だけの欄 types で一覧へ運ぶ(種類ごとの型は型の関数なので deps から取り出せない)
 */
export type RouteDevicePlug<
  TAuthenticated extends RouteAuthenticatedDevice,
  TCategory extends string,
  TDevices extends Record<string, unknown>,
  TAnyDevice,
> = {
  deps: RouteDeviceDeps<TAuthenticated, TCategory>;
  /** 型だけ(値は置かない) */
  types?: { devices: TDevices; anyDevice: TAnyDevice };
};

// 一覧の要素の型(宣言の type。項目ごとに具体の型が違うので型引数は any で受ける)
export type AnyRouteUserPlug = RouteUserPlug<any, any>;
export type AnyRouteRateLimitPlug = RouteRateLimitPlug<any>;
export type AnyRouteDevicePlug = RouteDevicePlug<any, any, any, any>;
export type AnyRouteMaintenancePlug = RouteMaintenancePlug<any>;

// ---- 生成された <点>Map の型から具体の型を取り出す(P = Map の値の型の union、項目が無ければ never) ----

/** <点>Map の値の型(項目が無ければ never) */
export type PlugOfMap<M> = M[keyof M];

type DepsOf<P> = P extends { deps: infer D } ? D : never;

/** 利用者の型 */
export type UserOf<P> = DepsOf<P> extends { resolveUser: () => Promise<infer U> } ? NonNullable<U> : never;
/** status の型 */
export type StatusOf<P> = DepsOf<P> extends { availableStatuses: readonly (infer S)[] } ? S : never;
/** レート制限のカテゴリの名前 */
export type CategoryOf<P> = DepsOf<P> extends { checkRateLimit: (category: infer C, identifier: string) => unknown } ? C : never;
/** 認証済みの端末(端末の項目が無ければ lib の形) */
export type AuthenticatedDeviceOf<P> = [P] extends [never]
  ? RouteAuthenticatedDevice
  : DepsOf<P> extends { authenticateRequestDevice: (req: never) => Promise<infer A> } ? NonNullable<A> : never;

type DeviceTypesOf<P> = P extends { types?: infer T } ? NonNullable<T> : never;
/** 端末の種類 → 端末の型(端末の項目が無ければ空) */
export type DevicesOf<P> = [P] extends [never] ? Record<never, never> : DeviceTypesOf<P> extends { devices: infer D } ? D : never;
/** 端末の種類の名前(端末の項目が無ければ never) */
export type DeviceKindOf<P> = Extract<keyof DevicesOf<P>, string>;
/** 種類 K で絞った端末の型(K が never = 絞らない端末) */
export type DeviceOfKind<P, K extends string> = [K] extends [never]
  ? DeviceTypesOf<P> extends { anyDevice: infer A } ? A : never
  : K extends keyof DevicesOf<P> ? DevicesOf<P>[K] : never;
