// src/components/Form/Button/button-variants.ts

import { cva, type VariantProps } from "class-variance-authority";

export const buttonVariants = cva("disabled:pointer-events-auto disabled:cursor-not-allowed", {
  variants: {
    variant: {
      // 画面で主なアクションに使う標準のプライマリボタン。
      default: "bg-primary text-primary-foreground shadow-xs hover:bg-primary/90",
      // default のエイリアス。明示的にプライマリを指定したい場合に使用。
      primary: "bg-primary text-primary-foreground shadow-xs hover:bg-primary/90",
      // 削除など取り消せない重要な操作向けの強調ボタン。
      destructive:
        "bg-destructive text-white shadow-xs hover:bg-destructive/90 focus-visible:ring-destructive/20 dark:focus-visible:ring-destructive/40 dark:bg-destructive/60",
      // 成功・完了・確定などポジティブなアクション向けボタン。
      success:
        "bg-success text-success-foreground shadow-xs hover:bg-success/90 focus-visible:ring-success/20 dark:focus-visible:ring-success/40",
      // 情報提供・詳細表示など補足的アクション向けボタン。
      info:
        "bg-info text-info-foreground shadow-xs hover:bg-info/90 focus-visible:ring-info/20 dark:focus-visible:ring-info/40",
      // 注意喚起・確認が必要なアクション向けボタン。
      warning:
        "bg-warning text-warning-foreground shadow-xs hover:bg-warning/90 focus-visible:ring-warning/20 dark:focus-visible:ring-warning/40",
      // 低い強調度で背景になじむ枠線付きのボタン。
      outline:
        "border bg-background shadow-xs hover:bg-accent hover:text-accent-foreground dark:bg-input/30 dark:border-input dark:hover:bg-input/50",
      // プライマリと組み合わせる代替のセカンダリボタン。
      secondary: "bg-secondary text-secondary-foreground shadow-xs hover:bg-secondary/80",
      // ホバー表現は残しつつ主張を抑えた三次的アクション用ボタン。
      ghost: "hover:bg-accent hover:text-accent-foreground dark:hover:bg-accent/50",
      // プロモーションなど目立たせたいアクション向けのアクセント色ボタン。
      accent:
        "bg-accent text-accent-foreground shadow-lg hover:bg-accent/90 focus-visible:ring-accent/30 dark:focus-visible:ring-accent/50",
      // ツールバーなどで使うアイコンのみの控えめなボタン。
      mutedIcon: "text-muted-foreground hover:text-foreground",
    },
    size: {
      // インラインUIなど極小サイズ。
      xxxs: "h-6 rounded gap-0.5 px-1.5 min-w-10 text-xs",
      // 密集したUI向けの超小サイズ。
      xxs: "h-7 rounded gap-0.5 px-2 min-w-12 text-xs",
      // 最小のテキストボタン用サイズ。
      xs: "h-8 rounded-md gap-1 px-2.5 min-w-14",
      // 少し小さめのコンパクトサイズ。
      sm: "h-9 rounded-md gap-1.5 px-3 min-w-16",
      // 標準的に使うミディアムサイズ。
      md: "h-10 px-4 py-2 min-w-20",
      // 余裕を持たせた大きめサイズ。
      lg: "h-11 rounded-md px-6 min-w-24",
      // さらに強調する幅広ボタン。
      xl: "h-12 rounded-md px-8 min-w-28",
      // ヒーローアクションなどで使う特大サイズ。
      xxl: "h-14 rounded-md px-10 min-w-32",
      // 極端に広い横幅を確保したい時の最大サイズ。
      xxxl: "h-16 rounded-md px-12 min-w-36",
      // アイコンのみで使う正方形サイズ。
      icon: "size-9",
    },
    /** アイコン付きボタンの視覚的補正を有効にする @default false */
    opticalAdjust: {
      true: "",
      false: "",
    },
  },
  compoundVariants: [
    // opticalAdjust: true の場合、アイコン付きボタンのpaddingを調整
    { opticalAdjust: true, size: "xxxs", className: "has-[>svg]:px-1" },
    { opticalAdjust: true, size: "xxs", className: "has-[>svg]:px-1.5" },
    { opticalAdjust: true, size: "xs", className: "has-[>svg]:px-2" },
    { opticalAdjust: true, size: "sm", className: "has-[>svg]:px-2.5" },
    { opticalAdjust: true, size: "md", className: "has-[>svg]:px-3" },
    { opticalAdjust: true, size: "lg", className: "has-[>svg]:px-4" },
    { opticalAdjust: true, size: "xl", className: "has-[>svg]:px-5" },
    { opticalAdjust: true, size: "xxl", className: "has-[>svg]:px-6" },
    { opticalAdjust: true, size: "xxxl", className: "has-[>svg]:px-8" },
  ],
  defaultVariants: {
    variant: "default",
    size: "md",
    opticalAdjust: false,
  },
});

export type ButtonStyleProps = VariantProps<typeof buttonVariants>;