// src/features/core/admin/menu/items/messagingOverrides.ts
// 連絡の文言の上書き(messaging)。機能の門 messagingOverrides(既定 閉)の住所で閉じると隠れる

import { PencilLine } from "lucide-react";

import type { AdminMenuItemDefinition } from "../types";

export const item: AdminMenuItemDefinition = {
  key: "messagingOverrides",
  category: "marketing",
  order: 16,
  label: "文言の上書き",
  href: "/admin/messaging/overrides",
  icon: PencilLine,
};
