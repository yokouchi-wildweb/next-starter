import { type VariantProps } from "class-variance-authority";
import type { ComponentPropsWithoutRef, ReactNode } from "react";

import { VARIANT_OVERRIDES } from "@/config/ui/variants.config";
import { cn } from "@/lib/cn";

import { createTextVariants } from "./textVariants";

// 見た目の上書き口: src/config/ui/variants.config.ts の span({ base, tone, size, weight, align })
const spanVariants = createTextVariants("inline-block leading-relaxed", VARIANT_OVERRIDES.span);

export type SpanProps = ComponentPropsWithoutRef<"span"> &
  VariantProps<typeof spanVariants> & {
    children: ReactNode;
    /** 文中の一続きの文字: display inline、size / weight の既定を inherit にし行間も親に合わせる
     * (渡した size / weight はそれが勝つ)。既定 false = inline-block・md・normal */
    inline?: boolean;
  };

export function Span({
  inline = false,
  tone = "inherit",
  size = inline ? "inherit" : "md",
  align,
  weight = inline ? "inherit" : "normal",
  srOnly = false,
  className,
  children,
  ...props
}: SpanProps) {
  return (
    <span
      className={cn(
        spanVariants({ tone, size, align, weight, srOnly }),
        // size="inherit" では行間も親に合わせる(base の leading-relaxed を打ち消す)
        size === "inherit" && "leading-[inherit]",
        // 文中: inline-block を inline に替え、行間は親に合わせる
        inline && "inline leading-[inherit]",
        className,
      )}
      {...props}
    >
      {children}
    </span>
  );
}
