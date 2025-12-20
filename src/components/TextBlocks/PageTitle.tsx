import { type VariantProps } from "class-variance-authority";
import type { ComponentPropsWithoutRef } from "react";

import { cn } from "@/lib/cn";

import { createTextVariants } from "./textVariants";

const pageTitleVariants = createTextVariants("tracking-tight");

export type PageTitleProps = ComponentPropsWithoutRef<"h1"> &
  VariantProps<typeof pageTitleVariants>;

export function PageTitle({
  tone = "inherit",
  size = "xxl",
  align = "left",
  weight = "bold",
  srOnly = false,
  className,
  children,
  ...props
}: PageTitleProps) {
  return (
    <h1
      className={cn(
        pageTitleVariants({ tone, size, align, weight, srOnly }),
        className,
      )}
      {...props}
    >
      {children}
    </h1>
  );
}
