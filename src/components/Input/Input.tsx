// src/components/Input/Input.tsx

import * as React from "react";
import { XIcon } from "lucide-react";

import { cn } from "@/lib/cn";
import { createOverridableVariants, type InputSize } from "@/lib/variantOverrides";
import { variantOverrides } from "@/lib/variantOverrides/config";
import { Input as PrimitiveInput } from "@/components/Primitives/Input";
import { Button } from "@/components/Button/Button";

export type { InputSize } from "@/lib/variantOverrides";

/**
 * 入力欄系の高さ: 操作部品の高さの段 --control-h-<size>(src/styles/core/config.css の :root、ボタンの size と同じ名前)。
 * 高さを固定して中身を上下中央に置く(py-0)。md は 640px 未満 44px・以上 40px。
 * 上書きの口 = src/config/lib/variantOverrides.config.ts の input(入力欄系で 1 つを共有)。className はさらに後ろで勝つ
 */
export const INPUT_SIZE_CLASSES = {
  xs: "h-(--control-h-xs) py-0",
  sm: "h-(--control-h-sm) py-0",
  md: "h-(--control-h-md) py-0",
  lg: "h-(--control-h-lg) py-0",
  xl: "h-(--control-h-xl) py-0",
} satisfies Record<InputSize, string>;

/**
 * 欄の中の小さなボタン(クリア ×・パスワードの表示の切り替え・暦 / 時計を開く)の大きさ:
 * 欄の段の高さ − 8px の正方形(上下・右に 4px ずつ空く。位置は right-1 top-1/2 -translate-y-1/2)。
 * 欄 xs 32px → 24px・md 44 / 40px → 36 / 32px
 */
export const INNER_BUTTON_CLASSES = {
  xs: "size-[calc(var(--control-h-xs)-0.5rem)]",
  sm: "size-[calc(var(--control-h-sm)-0.5rem)]",
  md: "size-[calc(var(--control-h-md)-0.5rem)]",
  lg: "size-[calc(var(--control-h-lg)-0.5rem)]",
  xl: "size-[calc(var(--control-h-xl)-0.5rem)]",
} satisfies Record<InputSize, string>;

/** 中のボタンを右に置く欄の右の余白(ボタンの幅 + 右 4px + 文字との間 4px = 段の高さ) */
export const INNER_BUTTON_PADDING = {
  xs: "pr-(--control-h-xs)",
  sm: "pr-(--control-h-sm)",
  md: "pr-(--control-h-md)",
  lg: "pr-(--control-h-lg)",
  xl: "pr-(--control-h-xl)",
} satisfies Record<InputSize, string>;

/** 入力欄系の枠と高さの class(Input・ColorInput の hex 欄・Select などの引き金が共有する) */
export const inputVariants = createOverridableVariants(
  "border-muted-foreground/50",
  { variants: { size: INPUT_SIZE_CLASSES }, defaultVariants: { size: "md" } },
  variantOverrides.input,
);

export type InputProps = Omit<React.ComponentProps<typeof PrimitiveInput>, "size"> & {
  /** 高さの段(ボタンの size と同じ名前・同じ高さ)@default "md" */
  size?: InputSize;
  /** HTML の size 属性(表示する文字数の目安)。高さの size と分けてここで渡す */
  htmlSize?: number;
  /** 左側に表示するアイコン */
  leftIcon?: React.ReactNode;
  /** 指定すると値が入力されているとき右端にクリア（×）ボタンを表示する。controlled 入力（value 指定）でのみ動作 */
  onClear?: () => void;
};

const Input = React.forwardRef<HTMLInputElement, InputProps>((props, ref) => {
  const { className, readOnly, disabled, leftIcon, onClear, size, htmlSize, ...rest } = props;

  // readOnly または disabled 時のスタイル
  const inactiveStyles =
    readOnly || disabled
      ? "bg-muted/50 text-muted-foreground cursor-not-allowed focus-visible:ring-0 focus-visible:border-border"
      : "bg-background";

  // クリアボタンは編集可能かつ値が空でないときのみ表示
  const showClear =
    !!onClear && !readOnly && !disabled && rest.value != null && rest.value !== "";

  // アイコンもクリアボタンもない場合はシンプルにinputを返す
  if (!leftIcon && !onClear) {
    return (
      <PrimitiveInput
        ref={ref}
        readOnly={readOnly}
        disabled={disabled}
        size={htmlSize}
        className={cn(inactiveStyles, inputVariants({ size, className }))}
        {...rest}
      />
    );
  }

  // アイコンやクリアボタンがある場合はラッパーで囲む
  // h-fitでGridレイアウト内でも高さがinputに合うようにする
  return (
    <div className="relative h-fit">
      {leftIcon && (
        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
          {leftIcon}
        </span>
      )}
      <PrimitiveInput
        ref={ref}
        readOnly={readOnly}
        disabled={disabled}
        size={htmlSize}
        className={cn(leftIcon && "pl-10", onClear && INNER_BUTTON_PADDING[size ?? "md"], inactiveStyles, inputVariants({ size, className }))}
        {...rest}
      />
      {showClear && (
        <Button
          type="button"
          onClick={onClear}
          variant="mutedIcon"
          size="none"
          className={cn("absolute right-1 top-1/2 -translate-y-1/2", INNER_BUTTON_CLASSES[size ?? "md"])}
        >
          <XIcon className="size-4" />
          <span className="sr-only">入力をクリア</span>
        </Button>
      )}
    </div>
  );
});

Input.displayName = "Input";

export { Input };
