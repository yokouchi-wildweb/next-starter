// src/features/core/admin/menu/categories/community.ts

import { MessagesSquare } from "lucide-react";

import type { AdminMenuCategoryDefinition } from "../types";

export const category: AdminMenuCategoryDefinition = {
  key: "community",
  label: "コミュニティ",
  order: 500,
  icon: MessagesSquare,
};
