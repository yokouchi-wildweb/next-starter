// src/components/Form/button/BookmarkTag.tsx

"use client";

import * as React from "react";

import { cn } from "@/lib/cn";

import { Button, type ButtonProps } from "./Button";
import {
  TAG_BUTTON_BASE_CLASS,
  TAG_BUTTON_SELECTED_CLASS,
  TAG_BUTTON_UNSELECTED_CLASS,
} from "./TagButton";

export type BookmarkTagProps = ButtonProps & {
  /** 選択状態に応じて配色を切り替える */
  selected?: boolean;
};

const BookmarkTag = React.forwardRef<HTMLButtonElement, BookmarkTagProps>(
  (
    {
      selected = false,
      className,
      variant = "ghost",
      size = "default",
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
        size={size}
        className={cn(
          "bookmark-tag",
          TAG_BUTTON_BASE_CLASS,
          selected ? TAG_BUTTON_SELECTED_CLASS : TAG_BUTTON_UNSELECTED_CLASS,
          className,
        )}
        {...props}
      />
    );
  },
);

BookmarkTag.displayName = "BookmarkTag";

export { BookmarkTag };
export default BookmarkTag;
