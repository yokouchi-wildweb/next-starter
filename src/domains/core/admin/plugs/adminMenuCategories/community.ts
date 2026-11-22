// src/domains/core/admin/menu/categories/community.ts

import { MessagesSquare } from "lucide-react";

import type { AdminMenuCategoryDefinition } from "@/domains/core/admin/menu/types";

export const category: AdminMenuCategoryDefinition = {
  key: "community",
  label: "コミュニティ",
  order: 500,
  icon: MessagesSquare,
};
