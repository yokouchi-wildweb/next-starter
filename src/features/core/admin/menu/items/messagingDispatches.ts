// src/features/core/admin/menu/items/messagingDispatches.ts
// 送った回の一覧(連絡 messaging)。機能の門 messagingDispatches の住所で閉じると隠れる

import { Send } from "lucide-react";

import type { AdminMenuItemDefinition } from "../types";

export const item: AdminMenuItemDefinition = {
  key: "messagingDispatches",
  category: "marketing",
  order: 15,
  label: "送信の履歴",
  href: "/admin/messaging",
  icon: Send,
};
