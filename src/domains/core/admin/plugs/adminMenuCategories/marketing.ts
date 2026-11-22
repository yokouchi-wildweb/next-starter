// src/domains/core/admin/menu/categories/marketing.ts

import { Megaphone } from "lucide-react";

import type { AdminMenuCategoryDefinition } from "@/domains/core/admin/menu/types";

export const category: AdminMenuCategoryDefinition = {
  key: "marketing",
  label: "マーケティング",
  order: 100,
  icon: Megaphone,
};
