// src/domains/core/admin/menu/items/userGroups.ts
// ユーザーグループ(userGroup)。機能の門 userGroups(既定 閉)の住所で閉じると隠れる

import { UsersRound } from "lucide-react";

import type { AdminMenuItemDefinition } from "@/domains/core/admin/menu/types";

export const item: AdminMenuItemDefinition = {
  key: "userGroups",
  category: "users",
  order: 45,
  label: "ユーザーグループ",
  href: "/admin/user-groups",
  icon: UsersRound,
  allowRoles: ["admin"],
};
