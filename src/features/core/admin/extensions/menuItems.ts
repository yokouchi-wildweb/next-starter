// 生成物・編集不可: pnpm extensions:generate が src/features/core/admin/extensionPoints.ts から生成する
// menuItems: src/features/core/admin/menu/items/<名前>.ts(x) か <名前>/index.ts(x) の export const item(並びはファイル名の順)

import type { AdminMenuItemDefinition } from "@/features/core/admin/menu/types";

const menuItemsList: AdminMenuItemDefinition[] = [];
export const menuItems: Readonly<Record<string, AdminMenuItemDefinition>> = Object.assign(Object.create(null), Object.fromEntries(menuItemsList.map((item) => [String(item.key), item])));
if (Object.keys(menuItems).length !== menuItemsList.length) throw new Error("menuItems: key が重複している項目がある");
