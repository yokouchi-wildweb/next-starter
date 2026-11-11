import { type VariantProps } from "class-variance-authority";
import type { ComponentPropsWithoutRef, ReactNode } from "react";

import { VARIANT_OVERRIDES } from "@/config/ui/variants.config";
import { cn } from "@/lib/cn";

import { createTextVariants } from "./textVariants";

// 見た目の上書き口: src/config/ui/variants.config.ts の para({ base, tone, size, weight, align })
const paraVariants = createTextVariants("my-2 leading-relaxed", VARIANT_OVERRIDES.para);

export type ParaProps = ComponentPropsWithoutRef<"p"> &
  VariantProps<typeof paraVariants> & { children: ReactNode };

export function Para({
  tone = "inherit",
  size = "md",
  align = "left",
  weight = "normal",
  srOnly = false,
  className,
  children,
  ...props
}: ParaProps) {
  return (
    <p
      className={cn(
        paraVariants({ tone, size, align, weight, srOnly }),
        // size="inherit" では行間も親に合わせる(base の leading-relaxed を打ち消す)
        size === "inherit" && "leading-[inherit]",
        className,
      )}
      {...props}
    >
      {children}
    </p>
  );
}
