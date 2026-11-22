// 生成物・編集不可: pnpm generate extensions が src/lib/routeFactory/extensionPoints.ts から生成する
// routeFactoryDevice: 差す側の <ドメイン>/plugs/routeFactoryDevice/<名前>.ts(x) か <名前>/index.ts(x)(lib は <lib>/plugs/…)の export const plug(並びは<差す側>/<名前> の順、使う時に gate.plugs で閉じたドメインの項目を外す)
// routeFactoryMaintenance: 差す側の <ドメイン>/plugs/routeFactoryMaintenance/<名前>.ts(x) か <名前>/index.ts(x)(lib は <lib>/plugs/…)の export const plug(並びは<差す側>/<名前> の順、使う時に gate.plugs で閉じたドメインの項目を外す)
// routeFactoryRateLimit: 差す側の <ドメイン>/plugs/routeFactoryRateLimit/<名前>.ts(x) か <名前>/index.ts(x)(lib は <lib>/plugs/…)の export const plug(並びは<差す側>/<名前> の順、使う時に gate.plugs で閉じたドメインの項目を外す)
// routeFactoryUser: 差す側の <ドメイン>/plugs/routeFactoryUser/<名前>.ts(x) か <名前>/index.ts(x)(lib は <lib>/plugs/…)の export const plug(並びは<差す側>/<名前> の順、使う時に gate.plugs で閉じたドメインの項目を外す)

import type { AnyRouteDevicePlug, AnyRouteMaintenancePlug, AnyRouteRateLimitPlug, AnyRouteUserPlug } from "@/lib/routeFactory/points";

import { plug as routeFactoryDevice_pairedDevice_pairedDevice } from "@/domains/core/pairedDevice/plugs/routeFactoryDevice/pairedDevice";
import { plug as routeFactoryMaintenance_setting_maintenance } from "@/domains/core/setting/plugs/routeFactoryMaintenance/maintenance";
import { plug as routeFactoryRateLimit_rateLimit_ipRate } from "@/domains/core/rateLimit/plugs/routeFactoryRateLimit/ipRate";
import { plug as routeFactoryUser_auth_session } from "@/domains/core/auth/plugs/routeFactoryUser/session";

const routeFactoryDeviceMap = {
  pairedDevice: routeFactoryDevice_pairedDevice_pairedDevice,
} as const satisfies Readonly<Record<string, AnyRouteDevicePlug>>;
/** 名前(項目のファイル名)を鍵にした型。一覧は門番で絞ってから使う */
export type RouteFactoryDeviceMap = typeof routeFactoryDeviceMap;
export const routeFactoryDevice: { domain: string | null; name: string; requires: readonly string[]; plug: AnyRouteDevicePlug }[] = [
  { domain: "pairedDevice", name: "pairedDevice", requires: [], plug: routeFactoryDeviceMap.pairedDevice },
];

const routeFactoryMaintenanceMap = {
  maintenance: routeFactoryMaintenance_setting_maintenance,
} as const satisfies Readonly<Record<string, AnyRouteMaintenancePlug>>;
/** 名前(項目のファイル名)を鍵にした型。一覧は門番で絞ってから使う */
export type RouteFactoryMaintenanceMap = typeof routeFactoryMaintenanceMap;
export const routeFactoryMaintenance: { domain: string | null; name: string; requires: readonly string[]; plug: AnyRouteMaintenancePlug }[] = [
  { domain: "setting", name: "maintenance", requires: [], plug: routeFactoryMaintenanceMap.maintenance },
];

const routeFactoryRateLimitMap = {
  ipRate: routeFactoryRateLimit_rateLimit_ipRate,
} as const satisfies Readonly<Record<string, AnyRouteRateLimitPlug>>;
/** 名前(項目のファイル名)を鍵にした型。一覧は門番で絞ってから使う */
export type RouteFactoryRateLimitMap = typeof routeFactoryRateLimitMap;
export const routeFactoryRateLimit: { domain: string | null; name: string; requires: readonly string[]; plug: AnyRouteRateLimitPlug }[] = [
  { domain: "rateLimit", name: "ipRate", requires: [], plug: routeFactoryRateLimitMap.ipRate },
];

const routeFactoryUserMap = {
  session: routeFactoryUser_auth_session,
} as const satisfies Readonly<Record<string, AnyRouteUserPlug>>;
/** 名前(項目のファイル名)を鍵にした型。一覧は門番で絞ってから使う */
export type RouteFactoryUserMap = typeof routeFactoryUserMap;
export const routeFactoryUser: { domain: string | null; name: string; requires: readonly string[]; plug: AnyRouteUserPlug }[] = [
  { domain: "auth", name: "session", requires: [], plug: routeFactoryUserMap.session },
];
