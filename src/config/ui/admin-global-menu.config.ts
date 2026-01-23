// src/config/admin-global-menu.config.ts

import { adminDataMenu } from "@/registry/adminDataMenu";
import type { UserRoleType } from "@/features/core/user/types";
import { APP_FEATURES } from "@/config/app/app-features.config";
import type { IconComponent } from "@/components/Icons";
import {
  Home,
  Database,
  Users,
  Palette,
  Settings,
  ExternalLink,
  LogOut,
  Megaphone,
  Ticket,
} from "lucide-react";

// ============================================
// アイコン表示設定
// ============================================

/** メニューにアイコンを表示するか */
export const ADMIN_MENU_ICONS_ENABLED = true;

/** ログアウトボタンのアイコン */
export const ADMIN_LOGOUT_ICON = LogOut;

// ============================================
// 型定義
// ============================================

export type AdminMenuItem = {
  title: string;
  href: string;
  /** アイコン（省略可、ADMIN_MENU_ICONS_ENABLEDがtrueの場合のみ表示） */
  icon?: IconComponent;
};

export type AdminMenuSection = {
  title: string;
  href: string | null;
  items: AdminMenuItem[];
  /** 指定した場合、そのロールのみ表示（未指定は全員表示） */
  allowRoles?: UserRoleType[];
  /** セクションアイコン（省略可、ADMIN_MENU_ICONS_ENABLEDがtrueの場合のみ表示） */
  icon?: IconComponent;
};

export const adminMenu: AdminMenuSection[] = [

  {
    title: "ダッシュボード",
    href: "/admin",
    icon: Home,
    items: [
      { title: "アプリトップ", href: "/", icon: ExternalLink },
      { title: "管理画面トップ", href: "/admin", icon: Home },
    ],
  },
  ...(APP_FEATURES.marketing.showInAdminMenu
    ? [
        {
          title: "マーケティング",
          href: null,
          icon: Megaphone,
          items: [
            ...(APP_FEATURES.marketing.coupon.enabled
              ? [{ title: "クーポン", href: "/admin/coupons/official", icon: Ticket }]
              : []),
          ],
        },
      ]
    : []),
  {
    title: "データ管理",
    href: null,
    icon: Database,
    items: adminDataMenu,
  },
  {
    title: "ユーザー管理",
    href: null,
    icon: Users,
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
    icon: Palette,
    items: [
      { title: "タブデモ/概要", href: "/admin/tabs-demo/overview" },
      { title: "タブデモ/インサイト", href: "/admin/tabs-demo/insights" },
      { title: "タブデモ/アクション", href: "/admin/tabs-demo/actions" },
    ],
  },
  {
    title: "システム設定",
    href: "/admin/settings",
    icon: Settings,
    items: [],
  },
];
