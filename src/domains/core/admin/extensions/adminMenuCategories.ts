// 生成物・編集不可: pnpm generate extensions が src/domains/core/admin/extensionPoints.ts から生成する
// adminMenuCategories: 差す側の <ドメイン>/plugs/adminMenuCategories/<名前>.ts(x) か <名前>/index.ts(x)(lib は <lib>/plugs/…)の export const category(並びは<差す側>/<名前> の順、使う時に gate.plugs で閉じたドメインの項目を外す。隣の <名前>.override.ts の hidden・label・icon・allowRoles・order を重ねる)

import type { AdminMenuCategoryDefinition } from "@/domains/core/admin/menu/types";

import { category as adminMenuCategories_admin_community } from "@/domains/core/admin/plugs/adminMenuCategories/community";
import { category as adminMenuCategories_admin_data } from "@/domains/core/admin/plugs/adminMenuCategories/data";
import { category as adminMenuCategories_admin_marketing } from "@/domains/core/admin/plugs/adminMenuCategories/marketing";
import { category as adminMenuCategories_admin_requests } from "@/domains/core/admin/plugs/adminMenuCategories/requests";
import { category as adminMenuCategories_admin_system } from "@/domains/core/admin/plugs/adminMenuCategories/system";
import { category as adminMenuCategories_user_users } from "@/domains/core/user/plugs/adminMenuCategories/users";

export const adminMenuCategories: { domain: string | null; name: string; requires: readonly string[]; plug: AdminMenuCategoryDefinition }[] = [
  { domain: "admin", name: "community", requires: [], plug: adminMenuCategories_admin_community },
  { domain: "admin", name: "data", requires: [], plug: adminMenuCategories_admin_data },
  { domain: "admin", name: "marketing", requires: [], plug: adminMenuCategories_admin_marketing },
  { domain: "admin", name: "requests", requires: [], plug: adminMenuCategories_admin_requests },
  { domain: "admin", name: "system", requires: [], plug: adminMenuCategories_admin_system },
  { domain: "user", name: "users", requires: [], plug: adminMenuCategories_user_users },
];
