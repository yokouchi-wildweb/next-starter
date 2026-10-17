// src/lib/variantOverrides/types.ts
//
// variant オーバーライドマップの型。
// 下流は src/config/ui/variants.config.ts に「足したいクラス」だけを書き、
// 対象コンポーネント(Button / Badge)が cva の出力の後ろに結合する(tailwind-merge で後勝ち)。
// キー(button / badge.solid ...)と variant / size 名は upstream が維持する公開契約。

import type { BadgeSize, BadgeVariant } from "@/components/Badge/badge-variants";
import type { ButtonSizeName, ButtonVariantName } from "@/components/Form/Button/button-variants";
import type {
  TabletButtonSizeName,
  TabletButtonVariantName,
} from "@/components/Form/Button/tablet-button-variants";

/**
 * 1 コンポーネント分のオーバーライド。
 * - base: 全 variant / size に共通で足すクラス(例: "rounded-full shadow-none")
 * - variant / size: その名前のときだけ足すクラス
 * 結合順は cva 出力 → base → variant → size → 呼び出し側の className。
 */
export type VariantOverride<V extends string = string, S extends string = string> = {
  base?: string;
  variant?: Partial<Record<V, string>>;
  size?: Partial<Record<S, string>>;
};

/** Badge は 3 種(solid / soft / bookmarkTag)が size 定義を共有するため、size は badge 直下に 1 つ */
export type BadgeKindOverride = {
  base?: string;
  variant?: Partial<Record<BadgeVariant, string>>;
};

/** 下流が書く差分(全て任意) */
export type VariantOverridesInput = {
  button?: VariantOverride<ButtonVariantName, ButtonSizeName>;
  tabletButton?: VariantOverride<TabletButtonVariantName, TabletButtonSizeName>;
  badge?: {
    size?: Partial<Record<BadgeSize, string>>;
    solid?: BadgeKindOverride;
    soft?: BadgeKindOverride;
    bookmarkTag?: BadgeKindOverride;
  };
};

/** defineVariantOverrides() が返す完全形(未指定は空オブジェクト) */
export type VariantOverrides = {
  button: VariantOverride<ButtonVariantName, ButtonSizeName>;
  tabletButton: VariantOverride<TabletButtonVariantName, TabletButtonSizeName>;
  badge: {
    size: Partial<Record<BadgeSize, string>>;
    solid: BadgeKindOverride;
    soft: BadgeKindOverride;
    bookmarkTag: BadgeKindOverride;
  };
};
