// 生成物・編集不可: pnpm generate extensions が src/features/core/admin/extensionPoints.ts から生成する
// menuCategories: src/features/core/admin/menu/categories/<名前>.ts(x) か <名前>/index.ts(x) の export const category(並びはファイル名の順)

import type { AdminMenuCategoryDefinition } from "@/features/core/admin/menu/types";

import { category as menuCategories_community } from "@/features/core/admin/menu/categories/community";
import { category as menuCategories_data } from "@/features/core/admin/menu/categories/data";
import { category as menuCategories_marketing } from "@/features/core/admin/menu/categories/marketing";
import { category as menuCategories_requests } from "@/features/core/admin/menu/categories/requests";
import { category as menuCategories_system } from "@/features/core/admin/menu/categories/system";
import { category as menuCategories_users } from "@/features/core/admin/menu/categories/users";

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
