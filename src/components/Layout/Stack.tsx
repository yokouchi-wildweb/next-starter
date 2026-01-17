// src/components/Layout/Stack.tsx

import { cva, type VariantProps } from "class-variance-authority";
import type { ComponentPropsWithoutRef } from "react";

import { cn } from "@/lib/cn";

import { appearance, padding, paddingBlock, paddingInline, margin, marginBlock, marginInline } from "./commonVariants";

// Tailwind の spacing scale に準拠した gap 値
const SPACING_SCALE = [
  0, 0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4, 5, 6, 7, 8, 9, 10,
  11, 12, 14, 16, 20, 24, 28, 32, 36, 40, 44, 48, 52, 56, 60, 64, 72, 80, 96,
] as const;

export type StackSpace = (typeof SPACING_SCALE)[number];

// space 値から gap クラスを生成
const getGapClass = (space: StackSpace): string => {
  // 小数点を含む場合は特殊処理（0.5 -> gap-0.5）
  return `gap-${space}`;
};

const stackVariants = cva("flex flex-col", {
  variants: {
    appearance,
    padding,
    paddingBlock,
    paddingInline,
    margin,
    marginBlock,
    marginInline,
  },
});

type StackVariantProps = VariantProps<typeof stackVariants>;

type StackProps = Omit<ComponentPropsWithoutRef<"div">, "className"> &
  StackVariantProps & {
    /** 子要素間の縦方向のスペース（Tailwind spacing scale） */
    space?: StackSpace;
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
 * <Stack space={6}>
 *   <div>Item 1</div>
 *   <div>Item 2</div>
 * </Stack>
 *
 * @example
 * <Stack space={4} padding="md">
 *   <p>Paragraph 1</p>
 *   <p>Paragraph 2</p>
 * </Stack>
 */
export function Stack({
  space = 0,
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
  const gapClass = getGapClass(space);

  return (
    <div
      {...props}
      className={cn(
        stackVariants({
          appearance,
          padding,
          paddingBlock,
          paddingInline,
          margin,
          marginBlock,
          marginInline,
        }),
        gapClass,
        className,
      )}
    />
  );
}
