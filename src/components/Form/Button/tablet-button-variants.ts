// src/components/Form/Button/tablet-button-variants.ts

import { cva, type VariantProps } from "class-variance-authority";

/**
 * タブレットUI専用ボタンのバリアント定義。
 * 飲食店など、立ったまま・片手で・忙しい中タップする環境を想定。
 * 最小タップ領域 h-16（64px）、タッチフィードバック内蔵。
 */
export const tabletButtonVariants = cva(
  "disabled:pointer-events-auto disabled:cursor-not-allowed font-semibold active:scale-[0.97] active:brightness-90 transition-all",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground shadow-xs hover:bg-primary/90",
        primary: "bg-primary text-primary-foreground shadow-xs hover:bg-primary/90",
        destructive:
          "bg-destructive text-white shadow-xs hover:bg-destructive/90 focus-visible:ring-destructive/20 dark:focus-visible:ring-destructive/40 dark:bg-destructive/60",
        success:
          "bg-success text-success-foreground shadow-xs hover:bg-success/90 focus-visible:ring-success/20 dark:focus-visible:ring-success/40",
        info: "bg-info text-info-foreground shadow-xs hover:bg-info/90 focus-visible:ring-info/20 dark:focus-visible:ring-info/40",
        warning:
          "bg-warning text-warning-foreground shadow-xs hover:bg-warning/90 focus-visible:ring-warning/20 dark:focus-visible:ring-warning/40",
        outline:
          "border bg-background shadow-xs hover:bg-accent hover:text-accent-foreground dark:bg-input/30 dark:border-input dark:hover:bg-input/50",
        secondary: "bg-secondary text-secondary-foreground shadow-xs hover:bg-secondary/80",
        ghost: "hover:bg-accent hover:text-accent-foreground dark:hover:bg-accent/50",
      },
      size: {
        // 64px - コンパクトな操作
        sm: "h-16 rounded-lg gap-2 px-12 min-w-28 text-base",
        // 72px - 標準
        md: "h-18 rounded-lg gap-2 px-16 min-w-32 text-lg",
        // 80px - 主要アクション
        lg: "h-20 rounded-lg gap-3 px-20 min-w-36 text-lg",
        // 96px - ヒーロー操作
        xl: "h-24 rounded-xl gap-3 px-24 min-w-40 text-xl",
        // 64px 正方形アイコン
        icon: "size-16 rounded-lg",
        // 80px 正方形アイコン
        "icon-lg": "size-20 rounded-lg",
      },
      fullWidth: {
        true: "w-full",
        false: "",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "md",
      fullWidth: false,
    },
  },
);

export type TabletButtonStyleProps = VariantProps<typeof tabletButtonVariants>;
