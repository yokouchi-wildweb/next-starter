// src/components/Overlays/Loading/InlineLoader.tsx
//
// 流れの中に置く読み込みの表示(内容の代わりに置く Spinner + 省略できる文)。覆わない:
// 領域や画面を覆うのは ScreenLoader(local / fullscreen)。
import { type ReactNode } from "react";

import { Flex } from "@/components/Layout/Flex";
import { Spinner, type SpinnerVariant } from "./Spinner";
import { cn } from "@/lib/cn";

export type InlineLoaderSize = "sm" | "md" | "lg";

const SIZE_PRESETS = {
  // 横 1 行(一覧の足元・小さな枠の中)
  sm: { direction: "row", className: "py-2 text-xs text-muted-foreground", spinner: "size-4" },
  // 中央の塊(モーダル・区画の中身の代わり)
  md: { direction: "column", className: "py-8 text-sm text-muted-foreground", spinner: "size-6" },
  // 中央の大きな塊(画面の主な中身の代わり)
  lg: { direction: "column", className: "py-12 text-sm text-muted-foreground", spinner: "size-8" },
} as const satisfies Record<
  InlineLoaderSize,
  { direction: "row" | "column"; className: string; spinner: string }
>;

export type InlineLoaderProps = {
  /** 大きさの段 @default "md" */
  size?: InlineLoaderSize;
  /** Spinner の横(sm)/ 下(md・lg)に出す文。未指定 = Spinner だけ(読み上げ用の文「読み込み中」を隠して置く) */
  message?: ReactNode;
  /** 並びの向き(既定は段で決まる: sm = row、md・lg = column) */
  direction?: "row" | "column";
  /** 外側に足すクラス(余白・文字の大きさと色を段の値から上書きできる) */
  className?: string;
  /** Spinner に足すクラス(大きさ・色を段の値から上書きできる) */
  spinnerClassName?: string;
  /** Spinner の形 */
  spinnerVariant?: SpinnerVariant;
};

export function InlineLoader({
  size = "md",
  message,
  direction,
  className,
  spinnerClassName,
  spinnerVariant,
}: InlineLoaderProps) {
  const preset = SIZE_PRESETS[size];
  const hasMessage = message !== undefined && message !== null && message !== false && message !== "";

  return (
    <Flex
      direction={direction ?? preset.direction}
      align="center"
      justify="center"
      gap="xs"
      className={cn(preset.className, className)}
      role="status"
      aria-live="polite"
    >
      <Spinner className={cn(preset.spinner, spinnerClassName)} variant={spinnerVariant} />
      {hasMessage ? message : <span className="sr-only">読み込み中</span>}
    </Flex>
  );
}
