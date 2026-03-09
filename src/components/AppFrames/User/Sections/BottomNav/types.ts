import type { ComponentType, ReactNode } from "react";

/**
 * ボトムナビゲーションのアイテム定義
 *
 * @example
 * const item: BottomNavItem = {
 *   key: "home",
 *   label: "ホーム",
 *   href: "/",
 *   icon: Home,
 *   matchPaths: ["/", "/home"],
 * };
 */
export type BottomNavItem = {
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
