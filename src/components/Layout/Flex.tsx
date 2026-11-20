import { cva, type VariantProps } from "class-variance-authority";
import { ComponentProps } from "react";

import { cn } from "@/lib/cn";
import { boxSpacingClassName, spacingClassName, type BoxSpacingProps, type SpacingValue } from "@/lib/spacing";

import { appearance } from "./appearance";

const flexVariantDefinitions = {
  direction: {
    row: "flex-row",
    column: "flex-col",
    columnToRowSm: "flex-col sm:flex-row",
  },
  align: {
    stretch: "items-stretch",
    start: "items-start",
    center: "items-center",
    end: "items-end",
    centerToStartSm: "items-center sm:items-start",
  },
  justify: {
    start: "justify-start",
    end: "justify-end",
    center: "justify-center",
    between: "justify-between",
    centerToStartSm: "justify-center sm:justify-start",
  },
  wrap: {
    nowrap: "flex-nowrap",
    wrap: "flex-wrap",
  },
} as const;

/** Flex用のレイアウトバリアント(見た目だけ。余白は spacing.ts) */
const flexLayoutVariants = {
  appearance,
} as const;

const flexLayoutVariantsCva = cva("flex", { variants: flexLayoutVariants });
const flexVariants = cva("", { variants: flexVariantDefinitions });

type FlexProps = Omit<ComponentProps<"div">, "className"> &
  VariantProps<typeof flexLayoutVariantsCva> &
  VariantProps<typeof flexVariants> &
  BoxSpacingProps & {
    /** 子要素の間の余白(段の名前 / 幅別。既定 none = 0) */
    gap?: SpacingValue | null;
    className?: string;
  };

/**
 * Flexboxレイアウトコンポーネント
 *
 * ## 用途
 * - 子要素の配置（横並び、縦並び、中央揃えなど）を制御したい場合
 * - direction、align、justify、wrapなどのFlexboxプロパティが必要な場合
 *
 * ## 他コンポーネントとの違い
 * - Block: レイアウト配置が不要ならBlockを使用
 * - Stack: 単に縦方向の余白を制御したいだけならStackを使用（よりシンプル）
 * - Flex: 配置の制御（align、justify）や方向切り替えが必要な場合に使用
 *
 * ## 適切な使用例
 * - ヘッダー内のロゴとナビゲーションの横並び配置
 * - ボタングループの中央揃え
 * - レスポンシブで縦→横に切り替わるレイアウト
 *
 * ## 不適切な使用例
 * - 単に縦に並べて余白を付けたいだけ → Stackを使用
 * - レイアウト制御が不要なラッパー → Blockを使用
 */
export function Flex({
  appearance,
  padding,
  paddingBlock,
  paddingInline,
  margin,
  marginBlock,
  marginInline,
  gap = "none",
  direction = "row",
  align = "stretch",
  justify = "start",
  wrap = "nowrap",
  className,
  ...props
}: FlexProps) {
  // 並びは旧来の class の順(flex → 見た目 → 余白 → gap → 配置)を保つ
  const variantClasses = cn(
    flexLayoutVariantsCva({ appearance }),
    boxSpacingClassName({ padding, paddingBlock, paddingInline, margin, marginBlock, marginInline }),
    spacingClassName("gap", gap),
    flexVariants({ direction, align, justify, wrap }),
  );

  return <div data-component="Flex" className={cn(variantClasses, className)} {...props} />;
}
