// src/components/Badge/badge-variants.ts

/**
 * バッジコンポーネント共通のvariantとsize定義
 *
 * 下流は src/config/ui/variants.config.ts の `badge` キー(size / solid / soft / bookmarkTag)で、
 * ここを編集せずに形を差し替えられる。variant / size 名は下流の設定が参照する公開契約。
 */

import { VARIANT_OVERRIDES } from "@/config/ui/variants.config";
import { variantOverrideClasses } from "@/lib/variantOverrides";

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

/** バッジの種類(variants.config.ts の badge 直下のキーと一致) */
export type BadgeKind = "solid" | "soft" | "bookmarkTag";

/**
 * 下流オーバーライドのうち、この種類・variant・size に該当するクラスを順に返す。
 * 各バッジは `cn(BASE, variantStyles[variant], badgeSizeStyles[size], ...badgeOverrideClasses(kind, variant, size), className)` の順で結合する。
 */
export function badgeOverrideClasses(kind: BadgeKind, variant: BadgeVariant, size: BadgeSize) {
  return variantOverrideClasses(
    { ...VARIANT_OVERRIDES.badge[kind], size: VARIANT_OVERRIDES.badge.size },
    { variant, size },
  );
}
