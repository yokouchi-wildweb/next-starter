// src/components/Badge/SolidBadge.tsx

import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import type { LucideIcon } from "lucide-react";

import { cn } from "@/lib/cn";

import {
  solidBadgeVariants,
  type SolidBadgeVariantProps,
} from "./solid-badge-variants";

export type SolidBadgeProps = React.ComponentPropsWithoutRef<"span"> &
  SolidBadgeVariantProps & {
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
 */
export const SolidBadge = React.forwardRef<HTMLSpanElement, SolidBadgeProps>(
  ({ className, variant, size, asChild = false, icon: Icon, children, ...props }, ref) => {
    const Comp = asChild ? Slot : "span";

    return (
      <Comp
        ref={ref}
        data-slot="solid-badge"
        className={cn(solidBadgeVariants({ variant, size }), className)}
        {...props}
      >
        {Icon && <Icon />}
        {children}
      </Comp>
    );
  }
);

SolidBadge.displayName = "SolidBadge";
