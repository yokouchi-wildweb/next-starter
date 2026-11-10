// src/features/core/user/mypageMenu/items/other.ts
// 閉じた機能(その他の操作 = 規則 mypageOther: 休会・退会がどちらも無効)のカードは棚の Link が描かない

import { EllipsisIcon } from "lucide-react";

import type { MypageMenuItem } from "@/features/core/user/types";

export const item: MypageMenuItem = {
  key: "other",
  order: 40,
  icon: EllipsisIcon,
  title: "その他の操作",
  description: "アカウントに関するその他の操作",
  href: "/mypage/other",
  variant: "muted",
  showChevron: true,
};
