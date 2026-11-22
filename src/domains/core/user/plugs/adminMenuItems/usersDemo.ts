// src/domains/core/admin/menu/items/usersDemo.ts

import { FlaskConical } from "lucide-react";

import type { AdminMenuItemDefinition } from "@/domains/core/admin/menu/types";

export const item: AdminMenuItemDefinition = {
  key: "usersDemo",
  category: "users",
  order: 30,
  label: "デモユーザー",
  href: "/admin/users/demo",
  icon: FlaskConical,
  allowRoles: ["admin"],
};
