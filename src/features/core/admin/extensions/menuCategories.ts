// 生成物・編集不可: pnpm extensions:generate が src/features/core/admin/extensionPoints.ts から生成する
// menuCategories: src/features/core/admin/menu/categories/<名前>.ts(x) か <名前>/index.ts(x) の export const category(並びはファイル名の順)

import type { AdminMenuCategoryDefinition } from "@/features/core/admin/menu/types";

const menuCategoriesList: AdminMenuCategoryDefinition[] = [];
export const menuCategories: Readonly<Record<string, AdminMenuCategoryDefinition>> = Object.assign(Object.create(null), Object.fromEntries(menuCategoriesList.map((item) => [String(item.key), item])));
if (Object.keys(menuCategories).length !== menuCategoriesList.length) throw new Error("menuCategories: key が重複している項目がある");
