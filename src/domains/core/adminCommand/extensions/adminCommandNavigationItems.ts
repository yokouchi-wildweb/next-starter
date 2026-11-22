// 生成物・編集不可: pnpm generate extensions が src/domains/core/adminCommand/extensionPoints.ts から生成する
// adminCommandNavigationItems: 差す側の <ドメイン>/plugs/adminCommandNavigationItems/<名前>.ts(x) か <名前>/index.ts(x)(lib は <lib>/plugs/…)の export const items(並びは<差す側>/<名前> の順、使う時に gate.plugs で閉じたドメインの項目を外す)

import type { NavigationItemGroup } from "@/domains/core/adminCommand/types";

import { items as adminCommandNavigationItems_adminCommand_admin } from "@/domains/core/adminCommand/plugs/adminCommandNavigationItems/admin";

export const adminCommandNavigationItems: { domain: string | null; name: string; requires: readonly string[]; plug: NavigationItemGroup }[] = [
  { domain: "adminCommand", name: "admin", requires: [], plug: adminCommandNavigationItems_adminCommand_admin },
];
