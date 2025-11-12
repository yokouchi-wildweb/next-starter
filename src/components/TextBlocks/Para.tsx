import { type VariantProps } from "class-variance-authority";
import type { ComponentPropsWithoutRef, ReactNode } from "react";

import { cn } from "@/lib/cn";

import { createTextVariants } from "./textVariants";

const paraVariants = createTextVariants("my-2 leading-relaxed");

export type ParaProps = ComponentPropsWithoutRef<"p"> &
  VariantProps<typeof paraVariants> & { children: ReactNode };

export function Para({
  tone = "default",
  size = "md",
  align = "left",
  className,
  children,
  ...props
}: ParaProps) {
  return (
    <p className={cn(paraVariants({ tone, size, align }), className)} {...props}>
      {children}
    </p>
  );
}
