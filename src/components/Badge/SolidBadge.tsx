// src/components/Badge/SolidBadge.tsx

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

/** Solid固有のベーススタイル */
const SOLID_BASE =
  "inline-flex items-center justify-center rounded-full font-medium w-fit whitespace-nowrap shrink-0 [&>svg]:pointer-events-none transition-[color,box-shadow] overflow-hidden";

/** Solid固有のvariantスタイル */
const solidVariantStyles: BadgeVariantStyles = {
  primary: "bg-primary text-primary-foreground",
  secondary: "bg-secondary text-secondary-foreground",
  destructive: "bg-destructive text-white",
  success: "bg-success text-success-foreground",
  info: "bg-info text-info-foreground",
  warning: "bg-warning text-warning-foreground",
  accent: "bg-accent text-accent-foreground",
  muted: "bg-muted text-muted-foreground",
  outline: "bg-background text-foreground border border-border",
  ghost: "bg-transparent text-foreground",
};

export type SolidBadgeProps = React.ComponentPropsWithoutRef<"span"> & {
  variant?: BadgeVariant;
  size?: BadgeSize;
  asChild?: boolean;
  /** アイコンコンポーネント（Lucideアイコンなど） */
  icon?: LucideIcon;
};

/**
 * ソリッドな印象のバッジコンポーネント（不透明背景 + foregroundテキスト）
 *
 * @example
 * <SolidBadge variant="success">有効</SolidBadge>
 * <SolidBadge variant="success" icon={Check}>有効</SolidBadge>
 * <SolidBadge variant="destructive">エラー</SolidBadge>
 * <SolidBadge variant="muted" size="sm">下書き</SolidBadge>
 * // asChild: 子要素(単一)にバッジスタイルをマージ（詳細は README.md）
 * <SolidBadge asChild variant="primary"><Button variant="none" size="none" onClick={...}>5台</Button></SolidBadge>
 */
export const SolidBadge = React.forwardRef<HTMLSpanElement, SolidBadgeProps>(
  ({ className, variant = "primary", size = "md", ...props }, ref) => {
    return (
      <BadgeCore
        ref={ref}
        data-slot="solid-badge"
        className={cn(
          SOLID_BASE,
          solidVariantStyles[variant],
          badgeSizeStyles[size],
          className
        )}
        {...props}
      />
    );
  }
);

SolidBadge.displayName = "SolidBadge";
