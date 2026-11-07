// src/features/core/admin/menu/items/userTags.ts

import { Tag } from "lucide-react";

import type { AdminMenuItemDefinition } from "../types";

export const item: AdminMenuItemDefinition = {
  key: "userTags",
  category: "users",
  order: 40,
  label: "ユーザータグ",
  href: "/admin/user-tags",
  icon: Tag,
  allowRoles: ["admin"],
};
