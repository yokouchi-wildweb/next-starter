// src/domains/core/admin/menu/categories/system.ts

import { Settings } from "lucide-react";

import type { AdminMenuCategoryDefinition } from "@/domains/core/admin/menu/types";

export const category: AdminMenuCategoryDefinition = {
  key: "system",
  label: "システム",
  order: 900,
  icon: Settings,
};
