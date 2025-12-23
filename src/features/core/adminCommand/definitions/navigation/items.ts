// src/lib/adminCommand/definitions/navigation/items.ts

import type { NavigationItem } from "../../types";

/**
 * ナビゲーション先の一覧
 * 新しいナビゲーション先を追加する場合はここに追加する
 */
export const navigationItems: NavigationItem[] = [
  {
    id: "nav-app-home",
    label: "アプリトップ (home)",
    description: "アプリのトップページに移動",
    href: "/",
    keywords: ["top", "トップ", "ホーム"],
  },
  {
    id: "nav-admin-home",
    label: "管理画面トップ (admin)",
    description: "管理画面のトップページに移動",
    href: "/admin",
    keywords: ["dashboard", "ダッシュボード"],
  },
  {
    id: "nav-admin-users-general",
    label: "ユーザー一覧 (users)",
    description: "一般ユーザーの管理",
    href: "/admin/users/general",
    keywords: ["user", "general", "一般"],
  },
  {
    id: "nav-admin-users-managerial",
    label: "管理者一覧 (managers)",
    description: "管理者ユーザーの管理",
    href: "/admin/users/managerial",
    keywords: ["manager", "managerial", "admin"],
  },
  {
    id: "nav-admin-settings",
    label: "システム設定 (settings)",
    description: "アプリケーションの設定",
    href: "/admin/settings",
    keywords: ["setting", "config", "設定"],
  },
  {
    id: "nav-admin-insane",
    label: "インセインモード (insane)",
    description: "特権的な管理機能",
    href: "/admin/insane",
    keywords: ["insane", "インセイン", "特権", "裏メニュー"],
    className: "opacity-30 hover:opacity-100 hover:bg-destructive hover:text-white data-[selected=true]:opacity-100 data-[selected=true]:bg-destructive data-[selected=true]:text-white",
  },
];
