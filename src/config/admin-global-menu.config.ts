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
    title: "ガチャ・商品設計",
    href: "#",
    items: [
      { title: "ガチャの設定", href: "/admin/gachas" },
      { title: "演出プレビュー", href: "/gacha/start" },
    ],
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
    title: "取引管理(未実装)",
    href: "#",
    items: [
      { title: "発送リクエスト一覧", href: "#" },
      { title: "ポイント還元履歴", href: "#" },
    ],
  },
  {
    title: "ポイント管理(未実装)",
    href: "#",
    items: [
      { title: "ポイントチャージ履歴", href: "#" },
      { title: "ポイント変動ログ", href: "#" },
    ],
  },
  {
    title: "お知らせ管理(未実装)",
    href: "#",
    items: [{ title: "お知らせ一覧", href: "#" }],
  },
  {
    title: "システム設定",
    href: "/admin/settings",
    items: [],
  },
];
