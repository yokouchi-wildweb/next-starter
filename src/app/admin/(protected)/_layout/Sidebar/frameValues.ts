// src/app/admin/(protected)/_layout/Sidebar/frameValues.ts
// 管理のサイドバーの枠の値(メニューの中身ではない: 中身は src/features/core/admin/menu/)。
// 値だけ。置き場は仮(設定の議会 D75 の枠の設定の置き場ができたら移す)

import { ExternalLink, Home, LogOut } from "lucide-react";

/** メニュー(枠の部品も)にアイコンを表示するか */
export const ADMIN_MENU_ICONS_ENABLED = true;

/** 枠の先頭: 管理画面トップ(/admin) */
export const ADMIN_HOME_LINK = { label: "管理画面トップ", href: "/admin", icon: Home } as const;

/** 枠の末尾: アプリのトップ(/) */
export const ADMIN_SITE_LINK = { label: "アプリトップ", href: "/", icon: ExternalLink } as const;

/** ログアウトボタンのアイコン */
export const ADMIN_LOGOUT_ICON = LogOut;
