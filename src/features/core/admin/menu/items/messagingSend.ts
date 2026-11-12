// src/features/core/admin/menu/items/messagingSend.ts
// 連絡を送る(messaging)。機能の門 messagingBroadcast(既定 閉)の住所で閉じると隠れる

import { Megaphone } from "lucide-react";

import type { AdminMenuItemDefinition } from "../types";

export const item: AdminMenuItemDefinition = {
  key: "messagingSend",
  category: "marketing",
  order: 14,
  label: "連絡を送る",
  href: "/admin/messaging/send",
  icon: Megaphone,
};
