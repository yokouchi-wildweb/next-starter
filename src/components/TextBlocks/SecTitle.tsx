import { type VariantProps } from "class-variance-authority";
import type { HTMLAttributes, ReactNode } from "react";

import { cn } from "@/lib/cn";

import { createTextVariants } from "./textVariants";

const secTitleVariants = createTextVariants("");

type HeadingElement = "h1" | "h2" | "h3" | "h4" | "h5" | "h6";

type BaseHeadingProps = Omit<HTMLAttributes<HTMLHeadingElement>, "children"> & {
  children: ReactNode;
};

export type SecTitleProps = BaseHeadingProps &
  VariantProps<typeof secTitleVariants> & { as?: HeadingElement };

export function SecTitle({
  as,
  tone = "inherit",
  size = "xl",
  align = "left",
  weight = "bold",
  srOnly = false,
  className,
  children,
  ...props
}: SecTitleProps) {
  const Component = (as ?? "h2") as HeadingElement;
  return (
    <Component
      className={cn(
        secTitleVariants({ tone, size, align, weight, srOnly }),
        className,
      )}
      {...props}
    >
      {children}
    </Component>
  );
}
