// src/features/core/admin/menu/items/usersGeneral.ts

import { UserRound } from "lucide-react";

import type { AdminMenuItemDefinition } from "../types";

export const item: AdminMenuItemDefinition = {
  key: "usersGeneral",
  category: "users",
  order: 10,
  label: "登録ユーザー",
  href: "/admin/users/general",
  icon: UserRound,
  allowRoles: ["admin"],
};
