/**
 * Header コンポーネント共通型定義・ユーティリティ
 */

import type { IconComponent } from "@/components/Icons";

// ============================================
// 型定義
// ============================================

/** ナビゲーションメニューアイテム */
export type NavigationMenuItem = {
  readonly key: string;
  readonly label: string;
  readonly href?: string | null;
  readonly onClick?: () => void;
  readonly disabled?: boolean;
  readonly icon?: IconComponent;
  readonly children?: NavigationMenuItem[];
};

// ============================================
// 判定ユーティリティ関数
// ============================================

/** 子メニューを持っているか */
export const hasChildren = (item: NavigationMenuItem): boolean =>
  item.children != null && item.children.length > 0;

/** アクションアイテム（onClick）か */
export const isActionItem = (item: NavigationMenuItem): boolean =>
  typeof item.onClick === "function";

/** 有効なリンクを持っているか */
export const hasValidHref = (href: string | null | undefined): href is string =>
  href != null && href !== "";
