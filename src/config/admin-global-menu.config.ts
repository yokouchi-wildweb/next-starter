// src/config/admin-global-menu.config.ts

import { adminDataMenu } from "@/registry/adminDataMenu";
import type { AdminMenuItem, AdminMenuSection } from "@/types/adminMenu";

export type { AdminMenuItem, AdminMenuSection };
export const adminMenu: AdminMenuSection[] = [
  {
    title: "ダッシュボード",
    href: "/admin",
    items: [],
  },
  {
    title: "データ管理",
    href: "#",
    items: adminDataMenu,
  },
  {
    title: "ユーザー管理",
    href: "#",
    items: [
      { title: "登録ユーザー", href: "/admin/users/general" },
      { title: "システム管理者", href: "/admin/users/managerial" },
    ],
  },
  {
    title: "システム設定",
    href: "/admin/settings",
    items: [],
  },
];
