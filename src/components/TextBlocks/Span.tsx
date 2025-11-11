import { cva, type VariantProps } from "class-variance-authority";
import type { ComponentPropsWithoutRef, ReactNode } from "react";

import { cn } from "@/lib/cn";

import { textToneVariants, textSizeVariants, textVariantDefaults } from "./textVariants";

const spanVariants = cva("inline-block leading-relaxed", {
  variants: {
    tone: textToneVariants,
    size: textSizeVariants,
  },
  defaultVariants: {
    tone: textVariantDefaults.tone,
    size: textVariantDefaults.size,
  },
});

export type SpanProps = ComponentPropsWithoutRef<"span"> &
  VariantProps<typeof spanVariants> & { children: ReactNode };

export function Span({ tone, size, className, children, ...props }: SpanProps) {
  return (
    <span className={cn(spanVariants({ tone, size }), className)} {...props}>
      {children}
    </span>
  );
}
