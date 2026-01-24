// src/components/Badge/StatusBadge.tsx

import * as React from "react";
import { Slot } from "@radix-ui/react-slot";

import { cn } from "@/lib/cn";

import {
  statusBadgeVariants,
  type StatusBadgeVariantProps,
} from "./status-badge-variants";

export type StatusBadgeProps = React.ComponentPropsWithoutRef<"span"> &
  StatusBadgeVariantProps & {
    asChild?: boolean;
  };

/**
 * ステータス表示用のバッジコンポーネント
 *
 * @example
 * <StatusBadge variant="success">有効</StatusBadge>
 * <StatusBadge variant="destructive">エラー</StatusBadge>
 * <StatusBadge variant="muted" size="sm">下書き</StatusBadge>
 */
export const StatusBadge = React.forwardRef<HTMLSpanElement, StatusBadgeProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "span";

    return (
      <Comp
        ref={ref}
        data-slot="status-badge"
        className={cn(statusBadgeVariants({ variant, size }), className)}
        {...props}
      />
    );
  }
);

StatusBadge.displayName = "StatusBadge";
