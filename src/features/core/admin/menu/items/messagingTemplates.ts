// src/features/core/admin/menu/items/messagingTemplates.ts
// 保存されたテンプレート(messaging)。機能の門 messagingTemplates(既定 閉)の住所で閉じると隠れる

import { FileText } from "lucide-react";

import type { AdminMenuItemDefinition } from "../types";

export const item: AdminMenuItemDefinition = {
  key: "messagingTemplates",
  category: "marketing",
  order: 17,
  label: "テンプレート",
  href: "/admin/messaging/templates",
  icon: FileText,
};
