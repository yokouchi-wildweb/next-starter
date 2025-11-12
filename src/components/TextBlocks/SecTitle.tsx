import { type VariantProps } from "class-variance-authority";
import type { HTMLAttributes, ReactNode } from "react";

import { cn } from "@/lib/cn";

import { createTextVariants } from "./textVariants";

const secTitleVariants = createTextVariants("font-semibold");

type HeadingElement = "h1" | "h2" | "h3" | "h4" | "h5" | "h6";

type BaseHeadingProps = Omit<HTMLAttributes<HTMLHeadingElement>, "children"> & {
  children: ReactNode;
};

export type SecTitleProps = BaseHeadingProps &
  VariantProps<typeof secTitleVariants> & { as?: HeadingElement };

export function SecTitle({
  as,
  tone = "default",
  size = "xl",
  align = "left",
  className,
  children,
  ...props
}: SecTitleProps) {
  const Component = (as ?? "h2") as HeadingElement;
  return (
    <Component
      className={cn(secTitleVariants({ tone, size, align }), className)}
      {...props}
    >
      {children}
    </Component>
  );
}
