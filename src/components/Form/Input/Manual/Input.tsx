// @/components/Form/Input/Manual/Input.tsx

import * as React from "react";

import { cn } from "@/lib/cn";
import { Input as ShadcnInput } from "@/components/_shadcn/input";

export type InputProps = React.ComponentProps<typeof ShadcnInput> & {
  /** 左側に表示するアイコン */
  leftIcon?: React.ReactNode;
};

const Input = React.forwardRef<HTMLInputElement, InputProps>((props, ref) => {
  const { className, readOnly, disabled, leftIcon, ...rest } = props;

  // 共通の基本スタイル
  const baseStyles = "h-auto py-3 border-muted-foreground/50";

  // readOnly または disabled 時のスタイル
  const inactiveStyles =
    readOnly || disabled
      ? "bg-muted/50 text-muted-foreground cursor-not-allowed focus-visible:ring-0 focus-visible:border-border"
      : "bg-background";

  // アイコンがない場合はシンプルにinputを返す
  if (!leftIcon) {
    return <ShadcnInput ref={ref} readOnly={readOnly} disabled={disabled} className={cn(baseStyles, inactiveStyles, className)} {...rest} />;
  }

  // アイコンがある場合はラッパーで囲む
  // h-fitでGridレイアウト内でも高さがinputに合うようにする
  return (
    <div className="relative h-fit">
      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
        {leftIcon}
      </span>
      <ShadcnInput ref={ref} readOnly={readOnly} disabled={disabled} className={cn("pl-10", baseStyles, inactiveStyles, className)} {...rest} />
    </div>
  );
});

Input.displayName = "Input";

export { Input };
