// src/components/Badge/StatusBadge.tsx

import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import type { LucideIcon } from "lucide-react";

import { cn } from "@/lib/cn";

import {
  statusBadgeVariants,
  type StatusBadgeVariantProps,
} from "./status-badge-variants";

export type StatusBadgeProps = React.ComponentPropsWithoutRef<"span"> &
  StatusBadgeVariantProps & {
    asChild?: boolean;
    /** アイコンコンポーネント（Lucideアイコンなど） */
    icon?: LucideIcon;
  };

/**
 * ステータス表示用のバッジコンポーネント
 *
 * @example
 * <StatusBadge variant="success">有効</StatusBadge>
 * <StatusBadge variant="success" icon={Check}>有効</StatusBadge>
 * <StatusBadge variant="destructive">エラー</StatusBadge>
 * <StatusBadge variant="muted" size="sm">下書き</StatusBadge>
 */
export const StatusBadge = React.forwardRef<HTMLSpanElement, StatusBadgeProps>(
  ({ className, variant, size, asChild = false, icon: Icon, children, ...props }, ref) => {
    const Comp = asChild ? Slot : "span";

    return (
      <Comp
        ref={ref}
        data-slot="status-badge"
        className={cn(statusBadgeVariants({ variant, size }), className)}
        {...props}
      >
        {Icon && <Icon />}
        {children}
      </Comp>
    );
  }
);

StatusBadge.displayName = "StatusBadge";
