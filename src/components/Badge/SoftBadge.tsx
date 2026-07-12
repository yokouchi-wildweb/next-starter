// src/components/Badge/SoftBadge.tsx

import * as React from "react";
import type { LucideIcon } from "lucide-react";

import { cn } from "@/lib/cn";

import { BadgeCore } from "./BadgeCore";
import {
  badgeSizeStyles,
  type BadgeVariant,
  type BadgeSize,
  type BadgeVariantStyles,
} from "./badge-variants";

/** Soft固有のベーススタイル */
const SOFT_BASE =
  "relative inline-flex items-center justify-center rounded-full border font-medium w-fit whitespace-nowrap shrink-0 [&>svg]:pointer-events-none transition-[color,box-shadow]";

/** Soft固有のvariantスタイル */
const softVariantStyles: BadgeVariantStyles = {
  primary: "bg-primary/10 border-primary text-primary",
  secondary: "bg-secondary/10 border-secondary text-secondary",
  destructive: "bg-destructive/10 border-destructive text-destructive",
  success: "bg-success/10 border-success text-success",
  info: "bg-info/10 border-info text-info",
  warning: "bg-warning/10 border-warning text-warning",
  accent: "bg-accent/10 border-accent text-accent",
  muted: "bg-muted border-muted-foreground/30 text-muted-foreground",
  outline: "bg-transparent border-border text-foreground",
  ghost: "bg-transparent border-transparent text-foreground",
};

export type SoftBadgeProps = React.ComponentPropsWithoutRef<"span"> & {
  variant?: BadgeVariant;
  size?: BadgeSize;
  asChild?: boolean;
  /** アイコンコンポーネント（Lucideアイコンなど） */
  icon?: LucideIcon;
};

/**
 * 柔らかい印象のバッジコンポーネント（薄い背景 + ボーダー + 色付きテキスト）
 *
 * 透過色背景の下に不透明な下地を敷く二層構造。ラッパーspanは asChild 時も残り、
 * バッジスタイルと props は内側の要素（asChild 時は children）にマージされる。
 * ref はラッパーspanに付く（従来仕様）。
 *
 * @example
 * <SoftBadge variant="success">有効</SoftBadge>
 * <SoftBadge variant="success" icon={Check}>有効</SoftBadge>
 * <SoftBadge variant="destructive">エラー</SoftBadge>
 * <SoftBadge variant="muted" size="sm">下書き</SoftBadge>
 */
export const SoftBadge = React.forwardRef<HTMLSpanElement, SoftBadgeProps>(
  ({ className, variant = "primary", size = "md", ...props }, ref) => {
    return (
      <span ref={ref} data-slot="soft-badge" className="relative inline-flex w-fit">
        {/* 下層: 不透明な背景 */}
        <span className="absolute inset-0 bg-background rounded-full" />
        {/* 上層: 透過色背景 + コンテンツ */}
        <BadgeCore
          className={cn(
            SOFT_BASE,
            softVariantStyles[variant],
            badgeSizeStyles[size],
            className
          )}
          {...props}
        />
      </span>
    );
  }
);

SoftBadge.displayName = "SoftBadge";
