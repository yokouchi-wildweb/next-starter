// 生成物・編集不可: pnpm generate extensions が src/domains/core/adminCommand/extensionPoints.ts から生成する
// navigationItems: src/domains/core/adminCommand/navigationItems/<名前>.ts(x) か <名前>/index.ts(x) の export const items(並びはファイル名の順)

import type { NavigationItemGroup } from "@/domains/core/adminCommand/types";

import { items as navigationItems_admin } from "@/domains/core/adminCommand/navigationItems/admin";

export const navigationItems: NavigationItemGroup[] = [
  navigationItems_admin,
];
