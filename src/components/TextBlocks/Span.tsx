import { type VariantProps } from "class-variance-authority";
import type { ComponentPropsWithoutRef, ReactNode } from "react";

import { cn } from "@/lib/cn";

import { createTextVariants } from "./textVariants";

const spanVariants = createTextVariants("inline-block leading-relaxed");

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
        className,
      )}
      {...props}
    >
      {children}
    </span>
  );
}
