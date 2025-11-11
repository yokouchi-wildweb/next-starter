import { cva, type VariantProps } from "class-variance-authority";
import type { ComponentPropsWithoutRef, ReactNode } from "react";

import { cn } from "@/lib/cn";

import {
  textToneVariants,
  textSizeVariants,
  textVariantDefaults,
  textAlignVariants,
  textAlignDefault,
} from "./textVariants";

const paraVariants = cva("my-2 leading-relaxed", {
  variants: {
    tone: textToneVariants,
    size: textSizeVariants,
    align: textAlignVariants,
  },
  defaultVariants: {
    tone: textVariantDefaults.tone,
    size: textVariantDefaults.size,
    align: textAlignDefault,
  },
});

export type ParaProps = ComponentPropsWithoutRef<"p"> &
  VariantProps<typeof paraVariants> & { children: ReactNode };

export function Para({ tone, size, align, className, children, ...props }: ParaProps) {
  return (
    <p className={cn(paraVariants({ tone, size, align }), className)} {...props}>
      {children}
    </p>
  );
}
