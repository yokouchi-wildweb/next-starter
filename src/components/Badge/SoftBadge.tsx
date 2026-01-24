// src/components/Badge/SoftBadge.tsx

import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import type { LucideIcon } from "lucide-react";

import { cn } from "@/lib/cn";

import {
  softBadgeVariants,
  type SoftBadgeVariantProps,
} from "./soft-badge-variants";

export type SoftBadgeProps = React.ComponentPropsWithoutRef<"span"> &
  SoftBadgeVariantProps & {
    asChild?: boolean;
    /** アイコンコンポーネント（Lucideアイコンなど） */
    icon?: LucideIcon;
  };

/**
 * 柔らかい印象のバッジコンポーネント（薄い背景 + ボーダー + 色付きテキスト）
 *
 * @example
 * <SoftBadge variant="success">有効</SoftBadge>
 * <SoftBadge variant="success" icon={Check}>有効</SoftBadge>
 * <SoftBadge variant="destructive">エラー</SoftBadge>
 * <SoftBadge variant="muted" size="sm">下書き</SoftBadge>
 */
export const SoftBadge = React.forwardRef<HTMLSpanElement, SoftBadgeProps>(
  ({ className, variant, size, asChild = false, icon: Icon, children, ...props }, ref) => {
    const Comp = asChild ? Slot : "span";

    return (
      <span ref={ref} data-slot="soft-badge" className="relative inline-flex w-fit">
        {/* 下層: 不透明な背景 */}
        <span className="absolute inset-0 bg-background rounded-full" />
        {/* 上層: 透過色背景 + コンテンツ */}
        <Comp
          className={cn(softBadgeVariants({ variant, size }), className)}
          {...props}
        >
          {Icon && <Icon />}
          {children}
        </Comp>
      </span>
    );
  }
);

SoftBadge.displayName = "SoftBadge";
