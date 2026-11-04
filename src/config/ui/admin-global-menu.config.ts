// src/config/admin-global-menu.config.ts

import { adminDataMenu } from "@/registry/adminDataMenu";
import type { UserRoleType } from "@/features/core/user/types";
import { APP_FEATURES } from "@/config/app/app-features.config";
import { buildSettingMenuItems } from "@/features/core/setting/menu";
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
  Bell,
  ScrollText,
  Inbox,
  Banknote,
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
  /** 指定した場合、そのロールのみ表示（未指定は全員表示） */
  allowRoles?: UserRoleType[];
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

/**
 * 管理のサイドバーのメニュー。閉じた機能(門番の規則)の住所の行は書いたままでよい:
 * サイドバーが管理の枠の門番の値で除き、行が 0 で href の無い節も描かない(src/app/admin/(protected)/_layout/Sidebar/sidebarSections.ts)。
 * 規則でない出し分け(showInAdminMenu など)だけをここで書く
 */
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
            { title: "お知らせ", href: "/admin/notifications", icon: Bell },
            { title: "クーポン", href: "/admin/coupons/official", icon: Ticket },
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
  // 銀行振込レビューは規則 bankTransferReview(決済方法 bank_transfer_inhouse が選択可能なとき開く)で閉じる。
  // 閉じていれば行が除かれ、行が 0 になったこの節も描かれない
  {
    title: "リクエスト管理",
    href: null,
    icon: Inbox,
    items: [
      { title: "銀行振込レビュー", href: "/admin/bank-transfer-reviews/pending-review", icon: Banknote },
    ],
    allowRoles: ["admin"],
  },
  {
    title: "ユーザー管理",
    href: null,
    icon: Users,
    items: [
      { title: "登録ユーザー", href: "/admin/users/general" },
      { title: "システム管理者", href: "/admin/users/system" },
      { title: "デモユーザー", href: "/admin/users/demo" },
      { title: "ユーザータグ", href: "/admin/user-tags" },
    ],
    allowRoles: ["admin"],
  },
  // 現状運用では未使用のため一時的に非表示。再開時はコメントアウトを解除する。
  // {
  //   title: "監査ログ",
  //   href: "/admin/audit-logs",
  //   icon: ScrollText,
  //   items: [
  //     { title: "横断検索", href: "/admin/audit-logs" },
  //   ],
  //   allowRoles: ["admin"],
  // },
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
    href: null,
    icon: Settings,
    items: buildSettingMenuItems(),
  },
];
