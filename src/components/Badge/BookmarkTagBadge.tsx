// src/components/Badge/BookmarkTagBadge.tsx

import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import type { LucideIcon } from "lucide-react";

import { cn } from "@/lib/cn";

import {
  bookmarkTagBadgeVariants,
  type BookmarkTagBadgeVariantProps,
} from "./bookmark-tag-badge-variants";

export type BookmarkTagBadgeProps = React.ComponentPropsWithoutRef<"span"> &
  BookmarkTagBadgeVariantProps & {
    asChild?: boolean;
    /** アイコンコンポーネント（Lucideアイコンなど） */
    icon?: LucideIcon;
    /** 選択状態（false の場合は muted スタイルになる） */
    selected?: boolean;
  };

/**
 * ブックマークタグ型のバッジコンポーネント（角なし、ボーダー付き）
 *
 * @example
 * <BookmarkTagBadge>タグ</BookmarkTagBadge>
 * <BookmarkTagBadge variant="success">有効</BookmarkTagBadge>
 * <BookmarkTagBadge selected>選択中</BookmarkTagBadge>
 * <BookmarkTagBadge selected={false}>未選択</BookmarkTagBadge>
 * <BookmarkTagBadge icon={Tag} size="sm">小さいタグ</BookmarkTagBadge>
 */
export const BookmarkTagBadge = React.forwardRef<
  HTMLSpanElement,
  BookmarkTagBadgeProps
>(
  (
    {
      className,
      variant,
      size,
      asChild = false,
      icon: Icon,
      selected,
      children,
      ...props
    },
    ref
  ) => {
    const Comp = asChild ? Slot : "span";

    // selected が明示的に指定されている場合、選択状態に応じて variant を切り替え
    const effectiveVariant =
      selected === undefined ? variant : selected ? variant : "muted";

    return (
      <Comp
        ref={ref}
        data-slot="bookmark-tag-badge"
        className={cn(
          bookmarkTagBadgeVariants({ variant: effectiveVariant, size }),
          className
        )}
        {...props}
      >
        {Icon && <Icon />}
        {children}
      </Comp>
    );
  }
);

BookmarkTagBadge.displayName = "BookmarkTagBadge";
