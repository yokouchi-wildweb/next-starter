// @/components/Form/Input/Manual/Input.tsx

import * as React from "react";
import { XIcon } from "lucide-react";

import { cn } from "@/lib/cn";
import { Input as ShadcnInput } from "@/components/_shadcn/input";
import { Button } from "@/components/Form/Button/Button";

export type InputProps = React.ComponentProps<typeof ShadcnInput> & {
  /** 左側に表示するアイコン */
  leftIcon?: React.ReactNode;
  /** 指定すると値が入力されているとき右端にクリア（×）ボタンを表示する。controlled 入力（value 指定）でのみ動作 */
  onClear?: () => void;
};

const Input = React.forwardRef<HTMLInputElement, InputProps>((props, ref) => {
  const { className, readOnly, disabled, leftIcon, onClear, ...rest } = props;

  // 共通の基本スタイル
  const baseStyles = "h-auto py-3 border-muted-foreground/50";

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
    return <ShadcnInput ref={ref} readOnly={readOnly} disabled={disabled} className={cn(baseStyles, inactiveStyles, className)} {...rest} />;
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
        className={cn(leftIcon && "pl-10", onClear && "pr-10", baseStyles, inactiveStyles, className)}
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
