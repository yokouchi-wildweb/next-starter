// src/config/admin-global-menu.config.ts

import { adminDataMenu } from "@/registry/adminDataMenu";
import type { UserRoleType } from "@/features/core/user/types";
import { APP_FEATURES } from "@/config/app/app-features.config";

export type AdminMenuItem = {
  title: string;
  href: string;
};

export type AdminMenuSection = {
  title: string;
  href: string | null;
  items: AdminMenuItem[];
  /** 指定した場合、そのロールのみ表示（未指定は全員表示） */
  allowRoles?: UserRoleType[];
};

export const adminMenu: AdminMenuSection[] = [

  {
    title: "ダッシュボード",
    href: "/admin",
    items: [
      { title: "アプリトップ", href: "/" },
      { title: "管理画面トップ", href: "/admin" },
    ],
  },
  {
    title: "データ管理",
    href: null,
    items: adminDataMenu,
  },
  {
    title: "ユーザー管理",
    href: null,
    items: [
      { title: "登録ユーザー", href: "/admin/users/general" },
      { title: "システム管理者", href: "/admin/users/system" },
      ...(APP_FEATURES.adminConsole.enableDemoUser
        ? [{ title: "デモユーザー", href: "/admin/users/demo" }]
        : []),
    ],
    allowRoles: ["admin"],
  },
  {
    title: "UIデモ",
    href: "/admin/tabs-demo/overview",
    items: [
      { title: "タブデモ/概要", href: "/admin/tabs-demo/overview" },
      { title: "タブデモ/インサイト", href: "/admin/tabs-demo/insights" },
      { title: "タブデモ/アクション", href: "/admin/tabs-demo/actions" },
    ],
  },
  {
    title: "システム設定",
    href: "/admin/settings",
    items: [],
  },
];
