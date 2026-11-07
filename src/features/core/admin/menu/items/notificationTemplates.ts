// src/features/core/admin/menu/items/notificationTemplates.ts

import { FileText } from "lucide-react";

import type { AdminMenuItemDefinition } from "../types";

export const item: AdminMenuItemDefinition = {
  key: "notificationTemplates",
  category: "marketing",
  order: 20,
  label: "通知テンプレート",
  href: "/admin/notification-templates",
  icon: FileText,
};
