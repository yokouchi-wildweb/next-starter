// src/features/core/admin/menu/items/dataMenu.ts
// 生成の管理一覧(@/registry/adminDomains)のうち domain.json の addToAdminDataMenu: true のドメインをこの位置に並べる。行のアイコンはこの項目のもの

import { Table2 } from "lucide-react";

import type { AdminMenuItemDefinition } from "../types";

export const item: AdminMenuItemDefinition = {
  key: "dataMenu",
  category: "data",
  order: 10,
  source: "dataMenu",
  icon: Table2,
};
