/**
 * ユーザー向けヘッダーの設定
 *
 * ★ プロジェクトごとにこのファイルを編集してカスタマイズしてください
 */

import type { ReactNode } from "react";

import { Home, LayoutGrid, LogIn, LogOut, User, UserPlus } from "lucide-react";
import { FileIcon } from "@/components/Icons";
import type { IconComponent } from "@/components/Icons";

// ヘッダー・ヘッダーのナビを出す・隠す(端末ごと・ページごと)は各ルートの枠の宣言 frame.default.ts / frame.ts。
// 書式: src/app/_layout/frame/README.md

// ============================================
// ロゴ設定
// ============================================

/** ロゴクリック時の遷移先 */
export const HEADER_LOGO_LINK = "/";

// ============================================
// メニューアイテム設定
// ============================================

/** メニューにアイコンを表示するか */
export const HEADER_MENU_ICONS_ENABLED = false;

/** メニューアイテムの型 */
export type HeaderMenuItem = {
  readonly key: string;
  readonly label: string;
  readonly href?: string;
  readonly icon?: IconComponent;
  readonly children?: HeaderMenuItem[];
};

/** 認証済みユーザー用メニュー（ログアウト以外） */
export const AUTHENTICATED_MENU_ITEMS: HeaderMenuItem[] = [
  { key: "home", label: "ホーム", href: "/", icon: Home },
  {
    key: "service",
    label: "サービス",
    icon: LayoutGrid,
    // href なし: クリックでリンク遷移しない（ドロップダウンのみ）
    children: [
      { key: "service-a", label: "サービスA", href: "/services/a" },
      { key: "service-b", label: "サービスB", href: "/services/b" },
    ],
  },
  { key: "mypage", label: "マイページ", href: "/mypage", icon: User },
];

/** 未認証ユーザー用メニュー */
export const GUEST_MENU_ITEMS: HeaderMenuItem[] = [
  { key: "home", label: "ホーム", href: "/", icon: Home },
  {
    key: "service",
    label: "サービス",
    href: "/services",  // href あり: クリックでリンク遷移も可能
    icon: LayoutGrid,
    children: [
      { key: "service-a", label: "サービスA", href: "/services/a" },
      { key: "service-b", label: "サービスB", href: "/services/b" },
    ],
  },
  { key: "login", label: "ログイン", href: "/login", icon: LogIn },
  { key: "signup", label: "会員登録", href: "/signup", icon: UserPlus },
];

// ============================================
// ログアウト設定
// ============================================

/** ログアウトボタンを表示するか（認証済みユーザーのみ対象） */
export const SHOW_LOGOUT_BUTTON = true;

/** ログアウトボタンのラベル */
export const LOGOUT_LABEL = "ログアウト";

/** ログアウトボタンのアイコン */
export const LOGOUT_ICON = LogOut;

/** ログアウト後のリダイレクト先 */
export const LOGOUT_REDIRECT_TO = "/login";

// ============================================
// バッジ設定
// ============================================

/**
 * メニューアイテムキーごとのバッジを返す hook
 *
 * ダウンストリームで差し替えてバッジを表示する。
 * hook なので内部で useUnreadCount() 等を自由に呼び出せる。
 *
 * @example
 * export const useHeaderMenuBadges = () => {
 *   const { count } = useUnreadCount();
 *   return { notification: count > 0 ? <UnreadDot /> : undefined };
 * };
 */
export const useHeaderMenuBadges: () => Record<string, ReactNode> = () => ({});

