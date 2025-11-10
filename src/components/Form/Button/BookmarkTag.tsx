// src/components/Form/Button/BookmarkTag.tsx

"use client";

import * as React from "react";

import { cn } from "@/lib/cn";

import { Button, type ButtonProps } from "./Button";

const BOOKMARK_TAG_BASE_CLASS = "h-auto px-3 py-1 text-sm border transition-colors rounded-none";
const BOOKMARK_TAG_SELECTED_CLASS =
  "bg-primary text-primary-foreground border-primary hover:bg-primary hover:text-primary-foreground";
const BOOKMARK_TAG_UNSELECTED_CLASS =
  "bg-muted text-muted-foreground border-border hover:bg-muted hover:text-muted-foreground";

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
          BOOKMARK_TAG_BASE_CLASS,
          selected ? BOOKMARK_TAG_SELECTED_CLASS : BOOKMARK_TAG_UNSELECTED_CLASS,
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
