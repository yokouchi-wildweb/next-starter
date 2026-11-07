// src/features/core/admin/menu/categories/requests.ts

import { Inbox } from "lucide-react";

import type { AdminMenuCategoryDefinition } from "../types";

export const category: AdminMenuCategoryDefinition = {
  key: "requests",
  label: "リクエスト管理",
  order: 200,
  icon: Inbox,
};
