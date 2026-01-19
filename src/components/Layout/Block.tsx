import { type VariantProps } from "class-variance-authority";
import type { ComponentPropsWithoutRef } from "react";

import { cn } from "@/lib/cn";

import { createLayoutVariants } from "./commonVariants";

const blockVariants = createLayoutVariants("block");

type BlockProps = ComponentPropsWithoutRef<"div"> & VariantProps<typeof blockVariants>;

/**
 * シンプルなブロック要素コンポーネント
 *
 * ## 用途
 * - 生のdivタグの代わりに使用
 * - padding/marginなどの余白をvariantで制御したい場合
 * - appearanceでカード風の見た目を適用したい場合
 *
 * ## 他コンポーネントとの違い
 * - Flex: レイアウト配置が必要な場合はFlexを使用
 * - Stack: 子要素間の縦方向の余白制御が目的ならStackを使用
 * - Block: レイアウト機能不要で、単純なラッパーや余白制御のみが目的
 *
 * ## 適切な使用例
 * - カード風のコンテナ（appearance="card"）
 * - 余白付きのシンプルなラッパー
 * - セマンティックな意味を持たないブロック要素
 *
 * ## 不適切な使用例
 * - 横並びや配置制御が必要 → Flexを使用
 * - 子要素間の縦余白を統一したい → Stackを使用
 */
export function Block({
  appearance,
  padding,
  paddingBlock,
  paddingInline,
  margin,
  marginBlock,
  marginInline,
  className,
  ...props
}: BlockProps) {
  return (
    <div
      data-component="Block"
      {...props}
      className={cn(
        blockVariants({
          appearance,
          padding,
          paddingBlock,
          paddingInline,
          margin,
          marginBlock,
          marginInline,
        }),
        className,
      )}
    />
  );
}
