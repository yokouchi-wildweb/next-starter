// @/components/Form/Input/Manual/Input.tsx

import * as React from "react";
import { XIcon } from "lucide-react";

import { cn } from "@/lib/cn";
import { createOverridableVariants, type InputSize } from "@/lib/variantOverrides";
import { VARIANT_OVERRIDES } from "@/config/ui/variants.config";
import { Input as ShadcnInput } from "@/components/Primitives/Input";
import { Button } from "@/components/Form/Button/Button";

export type { InputSize } from "@/lib/variantOverrides";

/**
 * 入力欄系の高さ: 操作部品の高さの段 --control-h-<size>(src/styles/core/config.css の :root、ボタンの size と同じ名前)。
 * 高さを固定して中身を上下中央に置く(py-0)。md は 640px 未満 44px・以上 40px。
 * 上書きの口 = src/config/ui/variants.config.ts の input(入力欄系で 1 つを共有)。className はさらに後ろで勝つ
 */
export const INPUT_SIZE_CLASSES = {
  xs: "h-(--control-h-xs) py-0",
  sm: "h-(--control-h-sm) py-0",
  md: "h-(--control-h-md) py-0",
  lg: "h-(--control-h-lg) py-0",
  xl: "h-(--control-h-xl) py-0",
} satisfies Record<InputSize, string>;

/** 入力欄系の枠と高さの class(Input・ColorInput の hex 欄・Select などの引き金が共有する) */
export const inputVariants = createOverridableVariants(
  "border-muted-foreground/50",
  { variants: { size: INPUT_SIZE_CLASSES }, defaultVariants: { size: "md" } },
  VARIANT_OVERRIDES.input,
);

export type InputProps = Omit<React.ComponentProps<typeof ShadcnInput>, "size"> & {
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
      <ShadcnInput
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
      <ShadcnInput
        ref={ref}
        readOnly={readOnly}
        disabled={disabled}
        size={htmlSize}
        className={cn(leftIcon && "pl-10", onClear && "pr-10", inactiveStyles, inputVariants({ size, className }))}
        {...rest}
      />
      {showClear && (
        <Button
          type="button"
          onClick={onClear}
          variant="mutedIcon"
          size="icon"
          className="absolute right-1 top-1/2 -translate-y-1/2"
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
