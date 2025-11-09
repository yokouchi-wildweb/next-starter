// src/components/Form/button/RoundedButton.tsx

import * as React from "react";

import { cn } from "@/lib/cn";

import { Button, type ButtonProps } from "./Button";

export const ROUNDED_BUTTON_BASE_CLASS = "h-auto px-3 py-1 text-sm border transition-colors";
export const ROUNDED_BUTTON_PILL_CLASS = "rounded-full";
export const ROUNDED_BUTTON_SELECTED_CLASS = "bg-primary text-primary-foreground border-primary";
export const ROUNDED_BUTTON_UNSELECTED_CLASS = "bg-muted text-muted-foreground border-border hover:bg-muted/80";

export type RoundedButtonProps = ButtonProps & {
  /** 選択状態に応じて配色を切り替える */
  selected?: boolean;
};

const RoundedButton = React.forwardRef<HTMLButtonElement, RoundedButtonProps>(
  (
    { selected = false, className, variant = "ghost", type = "button", ...props },
    ref,
  ) => {
    return (
      <Button
        ref={ref}
        type={type}
        variant={variant}
        className={cn(
          ROUNDED_BUTTON_BASE_CLASS,
          ROUNDED_BUTTON_PILL_CLASS,
          selected ? ROUNDED_BUTTON_SELECTED_CLASS : ROUNDED_BUTTON_UNSELECTED_CLASS,
          className,
        )}
        {...props}
      />
    );
  },
);

RoundedButton.displayName = "RoundedButton";

export { RoundedButton };
export type { RoundedButtonProps };
