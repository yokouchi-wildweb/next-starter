// src/features/core/admin/menu/items/notifications.ts

import { Bell } from "lucide-react";

import type { AdminMenuItemDefinition } from "../types";

export const item: AdminMenuItemDefinition = {
  key: "notifications",
  category: "marketing",
  order: 10,
  label: "お知らせ",
  href: "/admin/notifications",
  icon: Bell,
};
