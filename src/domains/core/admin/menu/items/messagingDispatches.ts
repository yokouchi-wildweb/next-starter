// src/domains/core/admin/menu/items/messagingDispatches.ts
// 通知の管理(messaging)のメニュー項目。1 つだけで、送信一覧・テンプレート・システム通知は画面の上のタブで行き来する
// (タブ: messaging/lib/adminSectionTabs.ts)。機能の門 messagingDispatches の住所で閉じると隠れる

import { Send } from "lucide-react";

import type { AdminMenuItemDefinition } from "../types";

export const item: AdminMenuItemDefinition = {
  key: "messagingDispatches",
  category: "marketing",
  order: 15,
  label: "メッセージ管理",
  href: "/admin/messaging",
  icon: Send,
};
