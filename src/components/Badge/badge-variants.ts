// src/components/Badge/badge-variants.ts

/**
 * バッジコンポーネント共通のvariantとsize定義
 */

/** 全バッジ共通のカラーバリアント */
export type BadgeVariant =
  | "primary"
  | "secondary"
  | "destructive"
  | "success"
  | "info"
  | "warning"
  | "accent"
  | "muted"
  | "outline"
  | "ghost";

/** 全バッジ共通のサイズ */
export type BadgeSize = "sm" | "md" | "lg";

/** 共通サイズ定義 */
export const badgeSizeStyles: Record<BadgeSize, string> = {
  // コンパクトUI向けの小サイズ
  sm: "px-2.5 py-1 text-xs gap-1 [&>svg]:size-3",
  // 標準サイズ
  md: "px-3 py-1 text-sm gap-1.5 [&>svg]:size-4",
  // 強調表示向けの大サイズ
  lg: "px-4 py-1.5 text-base gap-2 [&>svg]:size-5",
};

/** 各バッジが実装すべきvariantスタイルのインターフェース */
export type BadgeVariantStyles = Record<BadgeVariant, string>;
