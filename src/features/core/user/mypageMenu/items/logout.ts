// src/features/core/user/mypageMenu/items/logout.ts
// 操作の項目: action "logout" は MainMenu が useLogout に結ぶ

import { LogOutIcon } from "lucide-react";

import type { MypageMenuItem } from "@/features/core/user/types";

export const item: MypageMenuItem = {
  key: "logout",
  order: 30,
  icon: LogOutIcon,
  title: "ログアウト",
  pendingTitle: "ログアウト中...",
  description: "このアカウントからログアウト",
  action: "logout",
};
