// src/components/Layout/Stack.tsx

import { cva, type VariantProps } from "class-variance-authority";
import type { ComponentProps } from "react";

import { cn } from "@/lib/cn";
import { boxSpacingClassName, spacingClassName, type BoxSpacingProps, type SpacingValue } from "@/lib/spacing";

import { appearance } from "./appearance";

const stackVariants = cva("flex flex-col", {
  variants: {
    appearance,
  },
});

type StackVariantProps = VariantProps<typeof stackVariants>;

type StackProps = Omit<ComponentProps<"div">, "className"> &
  StackVariantProps &
  BoxSpacingProps & {
    /** 子要素間の縦方向の余白(段の名前 / 幅別。既定 none = 0) */
    gap?: SpacingValue | null;
    className?: string;
  };

/**
 * 縦方向にスタックするレイアウトコンポーネント
 *
 * ## 用途
 * - 複数の子要素間に「一定の縦方向の余白」を設けたい場合に使用
 * - space-y クラスの代替として使用
 *
 * ## 他コンポーネントとの違い
 * - Block: シンプルなブロック要素。余白制御が目的でない場合はBlockを使用
 * - Flex: 柔軟なレイアウト配置用。横並びや複雑な配置にはFlexを使用
 * - Stack: 子要素間の縦方向の余白制御に特化。レイアウトではなく「スペーシング」が目的
 *
 * ## 適切な使用例
 * - フォームのフィールド間の余白
 * - 記事内の段落間の余白
 * - リスト項目間の余白
 *
 * ## 不適切な使用例
 * - 単なるdivラッパー → Blockを使用
 * - 横並びレイアウト → Flexを使用
 * - グリッドレイアウト → Gridを使用
 *
 * @example
 * <Stack gap="lg">
 *   <div>Item 1</div>
 *   <div>Item 2</div>
 * </Stack>
 *
 * @example
 * <Stack gap="md" padding={{ base: "sm", sm: "md" }}>
 *   <p>Paragraph 1</p>
 *   <p>Paragraph 2</p>
 * </Stack>
 */
export function Stack({
  gap = "none",
  appearance,
  padding,
  paddingBlock,
  paddingInline,
  margin,
  marginBlock,
  marginInline,
  className,
  ...props
}: StackProps) {
  return (
    <div
      data-component="Stack"
      {...props}
      className={cn(
        stackVariants({ appearance }),
        boxSpacingClassName({ padding, paddingBlock, paddingInline, margin, marginBlock, marginInline }),
        spacingClassName("gap", gap),
        className,
      )}
    />
  );
}
