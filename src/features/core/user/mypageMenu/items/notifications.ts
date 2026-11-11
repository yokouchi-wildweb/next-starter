// src/features/core/user/mypageMenu/items/notifications.ts
// 通知の設定(連絡の好み)のカード。住所は門 messagingPreferences(既定 閉)の物で、閉の間は描く RichMenuCard の棚の Link が描かない

import { BellIcon } from "lucide-react";

import type { MypageMenuItem } from "@/features/core/user/types";

export const item: MypageMenuItem = {
  key: "notifications",
  order: 25,
  icon: BellIcon,
  title: "通知の設定",
  description: "受け取るお知らせ・メールを選ぶ",
  href: "/mypage/account/notifications",
  showChevron: true,
};
