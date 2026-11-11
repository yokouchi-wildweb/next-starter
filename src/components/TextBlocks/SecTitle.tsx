import { type VariantProps } from "class-variance-authority";
import type { HTMLAttributes, ReactNode } from "react";

import { VARIANT_OVERRIDES } from "@/config/ui/variants.config";
import { cn } from "@/lib/cn";

import { createTextVariants } from "./textVariants";

// 見た目の上書き口: src/config/ui/variants.config.ts の secTitle({ base, tone, size, weight, align })
const secTitleVariants = createTextVariants("", VARIANT_OVERRIDES.secTitle);

type HeadingElement = "h1" | "h2" | "h3" | "h4" | "h5" | "h6";

type BaseHeadingProps = Omit<HTMLAttributes<HTMLHeadingElement>, "children" | "slot"> & {
  children: ReactNode;
};

/** 見出しの印(data-slot)。admin-sec-title は上流の管理の SecTitle が渡す(fork は名前を変えずに印を狙う) */
export type SecTitleSlot = "sec-title" | "admin-sec-title";

export type SecTitleProps = BaseHeadingProps &
  VariantProps<typeof secTitleVariants> & {
    as?: HeadingElement;
    /** 印の名前(上流の包む部品だけが使う。既定 sec-title)。props の data-slot はこれに負ける */
    slot?: SecTitleSlot;
  };

export function SecTitle({
  as,
  tone = "inherit",
  size = "xl",
  align = "left",
  weight = "bold",
  srOnly = false,
  className,
  children,
  slot = "sec-title",
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
      data-slot={slot}
    >
      {children}
    </Component>
  );
}
