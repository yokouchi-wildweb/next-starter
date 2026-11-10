// src/features/core/user/mypageMenu/items/account.ts

import { UserCircleIcon } from "lucide-react";

import type { MypageMenuItem } from "@/features/core/user/types";

export const item: MypageMenuItem = {
  key: "account",
  order: 20,
  icon: UserCircleIcon,
  title: "アカウント基本情報",
  description: "ユーザー名、メールアドレスを確認・編集",
  href: "/mypage/account",
  showChevron: true,
};
