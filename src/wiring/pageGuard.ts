// 生成物・編集不可: pnpm generate extensions が src/lib/pageGuard/extensionPoints.ts から生成する
// pageGuardUser: 差す側の <ドメイン>/plugs/pageGuardUser/<名前>.ts(x) か <名前>/index.ts(x)(lib は <lib>/plugs/…)の export const plug(並びは<差す側>/<名前> の順、使う時に gate.plugs で閉じたドメインの項目を外す)
// 結び目: src/lib/pageGuard/extensionPoints.ts の wire(一覧を門番で絞って lib の wirePageGuard に渡す)

import { gate } from "@/featureGate";
import { wirePageGuard } from "@/lib/pageGuard";

import type { AnyPageGuardUserPlug } from "@/lib/pageGuard/points";

import { plug as pageGuardUser_auth_session } from "@/domains/core/auth/plugs/pageGuardUser/session";

const pageGuardUserMap = {
  session: pageGuardUser_auth_session,
} as const satisfies Readonly<Record<string, AnyPageGuardUserPlug>>;
/** 名前(項目のファイル名)を鍵にした型。一覧は門番で絞ってから使う */
export type PageGuardUserMap = typeof pageGuardUserMap;
export const pageGuardUser: { domain: string | null; name: string; requires: readonly string[]; plug: AnyPageGuardUserPlug }[] = [
  { domain: "auth", name: "session", requires: [], plug: pageGuardUserMap.session },
];

export const defineRootGuard = wirePageGuard<PageGuardUserMap>({ pageGuardUser: gate.plugs(pageGuardUser) });
