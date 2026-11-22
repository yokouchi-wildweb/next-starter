// src/domains/core/admin/menu/categories/data.ts

import { Database } from "lucide-react";

import type { AdminMenuCategoryDefinition } from "@/domains/core/admin/menu/types";

export const category: AdminMenuCategoryDefinition = {
  key: "data",
  label: "データ管理",
  order: 300,
  icon: Database,
};
