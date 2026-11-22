// 生成物・編集不可: pnpm generate extensions が src/domains/core/admin/extensionPoints.ts から生成する
// menuCategories: src/domains/core/admin/menu/categories/<名前>.ts(x) か <名前>/index.ts(x) の export const category(並びはファイル名の順)

import type { AdminMenuCategoryDefinition } from "@/domains/core/admin/menu/types";

import { category as menuCategories_community } from "@/domains/core/admin/menu/categories/community";
import { category as menuCategories_data } from "@/domains/core/admin/menu/categories/data";
import { category as menuCategories_marketing } from "@/domains/core/admin/menu/categories/marketing";
import { category as menuCategories_requests } from "@/domains/core/admin/menu/categories/requests";
import { category as menuCategories_system } from "@/domains/core/admin/menu/categories/system";
import { category as menuCategories_users } from "@/domains/core/admin/menu/categories/users";

const menuCategoriesList: AdminMenuCategoryDefinition[] = [
  menuCategories_community,
  menuCategories_data,
  menuCategories_marketing,
  menuCategories_requests,
  menuCategories_system,
  menuCategories_users,
];
export const menuCategories: Readonly<Record<string, AdminMenuCategoryDefinition>> = Object.assign(Object.create(null), Object.fromEntries(menuCategoriesList.map((item) => [String(item.key), item])));
if (Object.keys(menuCategories).length !== menuCategoriesList.length) throw new Error("menuCategories: key が重複している項目がある");
