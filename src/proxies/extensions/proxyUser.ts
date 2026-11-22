// 生成物・編集不可: pnpm generate extensions が src/proxies/extensionPoints.ts から生成する
// proxyUser: 差す側の <ドメイン>/plugs/proxyUser/<名前>.ts(x) か <名前>/index.ts(x)(lib は <lib>/plugs/…)の export const plug(並びは<差す側>/<名前> の順、使う時に gate.plugs で閉じたドメインの項目を外す)

import type { AnyProxyUserPlug } from "@/proxies/points";

import { plug as proxyUser_auth_session } from "@/domains/core/auth/plugs/proxyUser/session";

const proxyUserMap = {
  session: proxyUser_auth_session,
} as const satisfies Readonly<Record<string, AnyProxyUserPlug>>;
/** 名前(項目のファイル名)を鍵にした型。一覧は門番で絞ってから使う */
export type ProxyUserMap = typeof proxyUserMap;
export const proxyUser: { domain: string | null; name: string; requires: readonly string[]; plug: AnyProxyUserPlug }[] = [
  { domain: "auth", name: "session", requires: [], plug: proxyUserMap.session },
];
