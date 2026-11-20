// src/components/Button/variants/tablet-button-variants.ts
//
// TabletButton の variant 定義。size の高さはタブレット用の高さの段 --tablet-control-h-<名前>
// (src/styles/core/config.css の :root)から取る。下流は値をそこで、形を variants.config の tabletButton で変える。
// 名前の型(TabletButtonVariantName / TabletButtonSizeName)は @/lib/variantOverrides が持つ。表はそれを satisfies で満たす。

import type { VariantProps } from "class-variance-authority";

import {
  variantOverrides,
  createOverridableVariants,
  type TabletButtonSizeName,
  type TabletButtonVariantName,
} from "@/lib/variantOverrides";

const TABLET_BUTTON_VARIANTS = {
  variant: {
    default: "bg-primary text-primary-foreground shadow-xs hover:bg-primary/90",
    primary: "bg-primary text-primary-foreground shadow-xs hover:bg-primary/90",
    destructive:
      "bg-destructive text-destructive-foreground shadow-xs hover:bg-destructive/90 focus-visible:ring-destructive/20 dark:focus-visible:ring-destructive/40 dark:bg-destructive/60",
    success:
      "bg-success text-success-foreground shadow-xs hover:bg-success/90 focus-visible:ring-success/20 dark:focus-visible:ring-success/40",
    info: "bg-info text-info-foreground shadow-xs hover:bg-info/90 focus-visible:ring-info/20 dark:focus-visible:ring-info/40",
    warning:
      "bg-warning text-warning-foreground shadow-xs hover:bg-warning/90 focus-visible:ring-warning/20 dark:focus-visible:ring-warning/40",
    outline:
      "border bg-background shadow-xs hover:bg-accent hover:text-accent-foreground dark:bg-input/30 dark:border-input dark:hover:bg-input/50",
    secondary: "bg-secondary text-secondary-foreground shadow-xs hover:bg-secondary/80",
    ghost: "hover:bg-accent hover:text-accent-foreground dark:hover:bg-accent/50",
  } satisfies Record<TabletButtonVariantName, string>,
  size: {
    // 48px - 補助的な操作
    xxs: "h-(--tablet-control-h-xxs) rounded-lg gap-1.5 px-8 min-w-24 text-sm",
    // 56px - サブアクション
    xs: "h-(--tablet-control-h-xs) rounded-lg gap-2 px-10 min-w-26 text-base",
    // 64px - コンパクトな操作
    sm: "h-(--tablet-control-h-sm) rounded-lg gap-2 px-12 min-w-28 text-base",
    // 72px - 標準
    md: "h-(--tablet-control-h-md) rounded-lg gap-2 px-16 min-w-32 text-lg",
    // 80px - 主要アクション
    lg: "h-(--tablet-control-h-lg) rounded-lg gap-3 px-20 min-w-36 text-lg",
    // 96px - ヒーロー操作
    xl: "h-(--tablet-control-h-xl) rounded-xl gap-3 px-24 min-w-40 text-xl",
    // 64px 正方形アイコン
    icon: "size-16 rounded-lg",
    // 80px 正方形アイコン
    "icon-lg": "size-20 rounded-lg",
  } satisfies Record<TabletButtonSizeName, string>,
  fullWidth: {
    true: "w-full",
    false: "",
  },
};

/**
 * タブレットUI専用ボタンのバリアント定義。
 * 飲食店など、立ったまま・片手で・忙しい中タップする環境を想定。
 * 最小タップ領域 h-16（64px）、タッチフィードバック内蔵。
 * 下流は src/config/lib/variantOverrides.config.ts の `tabletButton` キーで差し替える。
 */
export const tabletButtonVariants = createOverridableVariants(
  "disabled:pointer-events-auto disabled:cursor-not-allowed font-semibold active:scale-[0.97] active:brightness-90 transition-all",
  {
    variants: TABLET_BUTTON_VARIANTS,
    defaultVariants: {
      variant: "default",
      size: "md",
      fullWidth: false,
    },
  },
  variantOverrides.tabletButton,
);

export type TabletButtonStyleProps = VariantProps<typeof tabletButtonVariants>;
