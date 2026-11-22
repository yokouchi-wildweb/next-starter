// src/domains/core/admin/menu/categories/requests.ts

import { Inbox } from "lucide-react";

import type { AdminMenuCategoryDefinition } from "@/domains/core/admin/menu/types";

export const category: AdminMenuCategoryDefinition = {
  key: "requests",
  label: "リクエスト管理",
  order: 200,
  icon: Inbox,
};
