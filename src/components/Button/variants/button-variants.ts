// src/components/Button/variants/button-variants.ts
//
// Button / LinkButton / PseudoButton 共通の variant 定義。
// 下流は src/config/lib/variantOverrides.config.ts の `button` キーで、ここを編集せずに
// 角丸・影・枠線・寸法などを差し替えられる(結合順: ここ → オーバーライド → 各要素の className)。
// variant / size の名前は下流の設定が参照する公開契約なので、削除・改名時は .notices で通知する。
// 名前の型(ButtonVariantName / ButtonSizeName)は @/lib/variantOverrides が持つ。表はそれを satisfies で満たす(名前を足すときは lib が先)。
// size の高さは操作部品の高さの段 --control-h-<名前>(src/styles/core/config.css の :root)から取る。
// 入力欄系も同じ段を読むので、同じ size のボタンと入力欄は同じ高さになる(md はスマホ 44px・640px 以上 40px)。

import type { VariantProps } from "class-variance-authority";

import { variantOverrides } from "@/lib/variantOverrides/config";
import { createOverridableVariants, type ButtonSizeName, type ButtonVariantName } from "@/lib/variantOverrides";

const BUTTON_VARIANTS = {
  variant: {
    // 画面で主なアクションに使う標準のプライマリボタン。
    default: "bg-primary text-primary-foreground shadow-xs hover:bg-primary/90",
    // default のエイリアス。明示的にプライマリを指定したい場合に使用。
    primary: "bg-primary text-primary-foreground shadow-xs hover:bg-primary/90",
    // 削除など取り消せない重要な操作向けの強調ボタン。
    destructive:
      "bg-destructive text-destructive-foreground shadow-xs hover:bg-destructive/90 focus-visible:ring-destructive/20 dark:focus-visible:ring-destructive/40 dark:bg-destructive/60",
    // 成功・完了・確定などポジティブなアクション向けボタン。
    success:
      "bg-success text-success-foreground shadow-xs hover:bg-success/90 focus-visible:ring-success/20 dark:focus-visible:ring-success/40",
    // 情報提供・詳細表示など補足的アクション向けボタン。
    info: "bg-info text-info-foreground shadow-xs hover:bg-info/90 focus-visible:ring-info/20 dark:focus-visible:ring-info/40",
    // 注意喚起・確認が必要なアクション向けボタン。
    warning:
      "bg-warning text-warning-foreground shadow-xs hover:bg-warning/90 focus-visible:ring-warning/20 dark:focus-visible:ring-warning/40",
    // 低い強調度で背景になじむ枠線付きのボタン。
    outline:
      "border bg-background shadow-xs hover:bg-accent hover:text-accent-foreground dark:bg-input/30 dark:border-input dark:hover:bg-input/50",
    // 削除など取り消せない操作を控えめに置く枠線付きボタン(赤い枠と文字。乗ると薄い赤の地)。
    // outline に赤の className を足すと、乗った時に outline の accent の地が出て色が合わないため、これを使う。
    destructiveOutline:
      "border border-destructive/50 bg-background text-destructive-text shadow-xs hover:bg-destructive/10 hover:border-destructive focus-visible:ring-destructive/20 dark:bg-input/30 dark:hover:bg-destructive/20 dark:focus-visible:ring-destructive/40",
    // 削除など取り消せない操作を行の中などに置く枠なしボタン(赤い文字。乗ると薄い赤の地)。
    destructiveGhost:
      "text-destructive-text hover:bg-destructive/10 focus-visible:ring-destructive/20 dark:hover:bg-destructive/20 dark:focus-visible:ring-destructive/40",
    // プライマリと組み合わせる代替のセカンダリボタン。
    secondary: "bg-secondary text-secondary-foreground shadow-xs hover:bg-secondary/80",
    // ホバー表現は残しつつ主張を抑えた三次的アクション用ボタン。
    ghost: "hover:bg-accent hover:text-accent-foreground dark:hover:bg-accent/50",
    // プロモーションなど目立たせたいアクション向けのアクセント色ボタン。
    accent:
      "bg-accent text-accent-foreground shadow-lg hover:bg-accent/90 focus-visible:ring-accent/30 dark:focus-visible:ring-accent/50",
    // ツールバーなどで使うアイコンのみの控えめなボタン。
    mutedIcon: "text-muted-foreground hover:text-foreground",
    // 色を一切付与しないニュートラル。独自スタイルを className で当てつつ、共通挙動(cursor/focus/a11y)だけ継承したい場合に使う。
    none: "",
  } satisfies Record<ButtonVariantName, string>,
  size: {
    // インラインUIなど極小サイズ。
    xxxs: "h-(--control-h-xxxs) rounded gap-0.5 px-1.5 min-w-10 text-xs",
    // 密集したUI向けの超小サイズ。
    xxs: "h-(--control-h-xxs) rounded gap-0.5 px-2 min-w-12 text-xs",
    // 最小のテキストボタン用サイズ。
    xs: "h-(--control-h-xs) rounded-md gap-1 px-2.5 min-w-14",
    // 少し小さめのコンパクトサイズ。
    sm: "h-(--control-h-sm) rounded-md gap-1.5 px-3 min-w-16",
    // 標準的に使うミディアムサイズ(640px 未満 44px・以上 40px)。
    md: "h-(--control-h-md) px-4 min-w-20",
    // 余裕を持たせた大きめサイズ。
    lg: "h-(--control-h-lg) rounded-md px-6 min-w-24",
    // さらに強調する幅広ボタン。
    xl: "h-(--control-h-xl) rounded-md px-8 min-w-28",
    // ヒーローアクションなどで使う特大サイズ。
    xxl: "h-(--control-h-xxl) rounded-md px-10 min-w-32",
    // 極端に広い横幅を確保したい時の最大サイズ。
    xxxl: "h-(--control-h-xxxl) rounded-md px-12 min-w-36",
    // アイコンのみで使う正方形サイズ。
    icon: "size-9",
    // 高さ・padding・min-width を一切付与しないニュートラル。寸法を className で完全に制御したい場合に使う。
    none: "",
  } satisfies Record<ButtonSizeName, string>,
  /** アイコン付きボタンの視覚的補正を有効にする @default false */
  opticalAdjust: {
    true: "",
    false: "",
  },
};

export const buttonVariants = createOverridableVariants(
  "disabled:pointer-events-auto disabled:cursor-not-allowed",
  {
    variants: BUTTON_VARIANTS,
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
  },
  variantOverrides.button,
);

export type ButtonStyleProps = VariantProps<typeof buttonVariants>;
