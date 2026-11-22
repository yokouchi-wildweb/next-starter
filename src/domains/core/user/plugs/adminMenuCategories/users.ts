// src/domains/core/admin/menu/categories/users.ts

import { Users } from "lucide-react";

import type { AdminMenuCategoryDefinition } from "@/domains/core/admin/menu/types";

export const category: AdminMenuCategoryDefinition = {
  key: "users",
  label: "ユーザー管理",
  order: 400,
  icon: Users,
};
