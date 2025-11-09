// src/components/Form/button/TagButton.tsx

import * as React from "react";

import { cn } from "@/lib/cn";

import { Button, type ButtonProps } from "./Button";

export const TAG_BUTTON_BASE_CLASS = "h-auto px-3 py-1 text-sm border transition-colors";
export const TAG_BUTTON_PILL_CLASS = "rounded-full";
export const TAG_BUTTON_SELECTED_CLASS = "bg-primary text-primary-foreground border-primary";
export const TAG_BUTTON_UNSELECTED_CLASS = "bg-muted text-muted-foreground border-border hover:bg-muted/80";

export type TagButtonProps = ButtonProps & {
  /** 選択状態に応じて配色を切り替える */
  selected?: boolean;
  /** true の場合は丸型のピル形状にする */
  rounded?: boolean;
};

const TagButton = React.forwardRef<HTMLButtonElement, TagButtonProps>(
  (
    {
      selected = false,
      rounded = true,
      className,
      variant = "ghost",
      type = "button",
      ...props
    },
    ref,
  ) => {
    return (
      <Button
        ref={ref}
        type={type}
        variant={variant}
        className={cn(
          TAG_BUTTON_BASE_CLASS,
          rounded && TAG_BUTTON_PILL_CLASS,
          selected ? TAG_BUTTON_SELECTED_CLASS : TAG_BUTTON_UNSELECTED_CLASS,
          className,
        )}
        {...props}
      />
    );
  },
);

TagButton.displayName = "TagButton";

export { TagButton };
