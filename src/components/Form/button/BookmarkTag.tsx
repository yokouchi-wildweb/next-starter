// src/components/Form/button/BookmarkTag.tsx

"use client";

import { Slot } from "@radix-ui/react-slot";
import { cn } from "@/lib/cn";

export type BookmarkTagProps = React.HTMLAttributes<HTMLElement> & {
  /**
   * Render the tag as the child element instead of a span.
   * Useful when you need a different element such as button.
   */
  asChild?: boolean;
};

export function BookmarkTag({ className, asChild = false, ...props }: BookmarkTagProps) {
  const Comp = asChild ? Slot : "span";
  return <Comp className={cn("bookmark-tag", className)} {...props} />;
}

export default BookmarkTag;
