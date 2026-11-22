// src/domains/core/admin/menu/items/usersSystem.ts

import { ShieldCheck } from "lucide-react";

import type { AdminMenuItemDefinition } from "@/domains/core/admin/menu/types";

export const item: AdminMenuItemDefinition = {
  key: "usersSystem",
  category: "users",
  order: 20,
  label: "システム管理者",
  href: "/admin/users/system",
  icon: ShieldCheck,
  allowRoles: ["admin"],
};
