// src/components/Badge/BookmarkTagBadge.tsx

import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import type { LucideIcon } from "lucide-react";

import { cn } from "@/lib/cn";

import {
  badgeSizeStyles,
  type BadgeVariant,
  type BadgeSize,
  type BadgeVariantStyles,
} from "./badge-variants";

/** BookmarkTag固有のベーススタイル */
const BOOKMARK_TAG_BASE =
  "inline-flex items-center justify-center rounded-none border font-medium w-fit whitespace-nowrap shrink-0 [&>svg]:pointer-events-none transition-colors";

/** BookmarkTag固有のvariantスタイル */
const bookmarkTagVariantStyles: BadgeVariantStyles = {
  primary: "bg-primary text-primary-foreground border-primary",
  secondary: "bg-secondary text-secondary-foreground border-secondary",
  destructive: "bg-destructive text-white border-destructive",
  success: "bg-success text-success-foreground border-success",
  info: "bg-info text-info-foreground border-info",
  warning: "bg-warning text-warning-foreground border-warning",
  accent: "bg-accent text-accent-foreground border-accent",
  muted: "bg-muted text-muted-foreground border-border",
  outline: "bg-background text-foreground border-border",
  ghost: "bg-transparent text-foreground border-transparent",
};

export type BookmarkTagBadgeProps = React.ComponentPropsWithoutRef<"span"> & {
  variant?: BadgeVariant;
  size?: BadgeSize;
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
      variant = "primary",
      size = "md",
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
          BOOKMARK_TAG_BASE,
          bookmarkTagVariantStyles[effectiveVariant],
          badgeSizeStyles[size],
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
