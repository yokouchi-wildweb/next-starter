/**
 * ユーザー向けボトムナビゲーションの設定
 *
 * ★ プロジェクトごとにこのファイルを編集してカスタマイズしてください
 */

import type { ReactNode } from "react";

import { Dices, History, LogIn, Package, User } from "lucide-react";

import type { ComponentType } from "react";
import type { LucideIcon } from "lucide-react";

// ============================================
// 型定義(枠の BottomNav が import する。config → app の依存を作らない)
// ============================================

/**
 * リンク項目(type 省略 = "link")
 *
 * @example
 * { key: "home", label: "ホーム", href: "/", icon: Home, matchPaths: ["/", "/home"] }
 */
export type BottomNavLinkItem = {
  readonly type?: "link";
  /** 一意のキー */
  readonly key: string;
  /** 表示ラベル */
  readonly label: string;
  /** リンク先パス */
  readonly href: string;
  /** Lucide-reactアイコンコンポーネント */
  readonly icon: ComponentType<{ className?: string }>;
  /**
   * カレント判定用のパス配列（オプション）
   * 指定しない場合はhrefと完全一致で判定
   * 指定した場合はmatchPathsのいずれかに前方一致で判定
   */
  readonly matchPaths?: readonly string[];
  /** アイコン右上に表示するバッジ（未読数やドットなど） */
  readonly badge?: ReactNode;
};

/** メニュー項目から開くアクション(遷移のみ) */
export type BottomNavMenuAction = {
  readonly key: string;
  readonly label: string;
  readonly href: string;
  readonly icon?: LucideIcon;
};

/**
 * メニュー項目(タップで上向きのアクションメニューを開く。例: 「＋」)。カレントにはならない
 *
 * @example
 * { type: "menu", key: "create", label: "作成", icon: Plus, menu: [{ key: "post", label: "投稿", href: "/posts/new" }] }
 */
export type BottomNavMenuItem = {
  readonly type: "menu";
  readonly key: string;
  readonly label: string;
  readonly icon: ComponentType<{ className?: string }>;
  /** メニューのタイトル(省略 = label) */
  readonly menuTitle?: string;
  readonly menu: readonly BottomNavMenuAction[];
  /** アイコン右上に表示するバッジ */
  readonly badge?: ReactNode;
};

/** ボトムナビゲーションのアイテム定義 */
export type BottomNavItem = BottomNavLinkItem | BottomNavMenuItem;

// ============================================
// 基本設定
// ============================================

/** ボトムナビゲーションを有効にするか */
export const BOTTOM_NAV_ENABLED = true;

/** ボトムナビの高さ（px） */
export const BOTTOM_NAV_HEIGHT = 64;

/** カレントアイテムの色（primary / secondary / accent） */
export const ACTIVE_COLOR_TYPE: "primary" | "secondary" | "accent" = "accent";

/**
 * アイテムキーごとのバッジを返す hook
 *
 * ダウンストリームで差し替えてバッジを表示する。
 * hook なので内部で useUnreadCount() 等を自由に呼び出せる。
 *
 * @example
 * export const useBottomNavBadges = () => {
 *   const { count } = useUnreadCount();
 *   return { chat: count > 0 ? <UnreadDot /> : undefined };
 * };
 */
export const useBottomNavBadges: () => Record<string, ReactNode> = () => ({});

// ============================================
// メニューアイテム設定
// ============================================

/** 認証済みユーザー用メニュー */
export const AUTHENTICATED_MENU_ITEMS: BottomNavItem[] = [
  {
    key: "game",
    label: "ゲームプレイ",
    href: "/game",
    icon: Dices,
  },
  {
    key: "items",
    label: "獲得商品",
    href: "/items",
    icon: Package,
  },
  {
    key: "history",
    label: "購入履歴",
    href: "/history",
    icon: History,
  },
  {
    key: "mypage",
    label: "マイページ",
    href: "/mypage",
    icon: User,
  },
];

/** 未認証ユーザー用メニュー */
export const GUEST_MENU_ITEMS: BottomNavItem[] = [
  {
    key: "game",
    label: "ゲームプレイ",
    href: "/game",
    icon: Dices,
  },
  {
    key: "login",
    label: "ログイン",
    href: "/login",
    icon: LogIn,
  },
];
