// src/features/core/user/mypageMenu/items/invite.ts
// 閉じた機能(招待 = 規則 referral)のカードは棚の Link が描かない

import { GiftIcon } from "lucide-react";

import type { MypageMenuItem } from "@/features/core/user/types";

export const item: MypageMenuItem = {
  key: "invite",
  order: 10,
  icon: GiftIcon,
  title: "招待コードを取得",
  description: "お友だちを招待して特典を獲得",
  href: "/mypage/invite",
  showChevron: true,
};
