import { type VariantProps } from "class-variance-authority";
import type { ComponentPropsWithoutRef, ReactNode } from "react";

import { VARIANT_OVERRIDES } from "@/config/ui/variants.config";
import { cn } from "@/lib/cn";

import { createTextVariants } from "./textVariants";

// 見た目の上書き口: src/config/ui/variants.config.ts の span({ base, tone, size, weight, align })
const spanVariants = createTextVariants("inline-block leading-relaxed", VARIANT_OVERRIDES.span);

export type SpanProps = ComponentPropsWithoutRef<"span"> &
  VariantProps<typeof spanVariants> & { children: ReactNode };

export function Span({
  tone = "inherit",
  size = "md",
  align,
  weight = "normal",
  srOnly = false,
  className,
  children,
  ...props
}: SpanProps) {
  return (
    <span
      className={cn(
        spanVariants({ tone, size, align, weight, srOnly }),
        // size="inherit" では行間も親に合わせる(base の leading-relaxed を打ち消す)
        size === "inherit" && "leading-[inherit]",
        className,
      )}
      {...props}
    >
      {children}
    </span>
  );
}
