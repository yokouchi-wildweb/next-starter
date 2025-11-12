import { type VariantProps } from "class-variance-authority";
import type { ComponentPropsWithoutRef } from "react";

import { cn } from "@/lib/cn";

import { createTextVariants } from "./textVariants";

const pageTitleVariants = createTextVariants("font-bold tracking-tight");

export type PageTitleProps = ComponentPropsWithoutRef<"h1"> &
  VariantProps<typeof pageTitleVariants>;

export function PageTitle({
  tone = "default",
  size = "xxl",
  align = "left",
  className,
  children,
  ...props
}: PageTitleProps) {
  return (
    <h1
      className={cn(pageTitleVariants({ tone, size, align }), className)}
      {...props}
    >
      {children}
    </h1>
  );
}
