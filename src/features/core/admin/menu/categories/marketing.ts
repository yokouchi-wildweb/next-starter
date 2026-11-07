// src/features/core/admin/menu/categories/marketing.ts

import { Megaphone } from "lucide-react";

import type { AdminMenuCategoryDefinition } from "../types";

export const category: AdminMenuCategoryDefinition = {
  key: "marketing",
  label: "マーケティング",
  order: 100,
  icon: Megaphone,
};
