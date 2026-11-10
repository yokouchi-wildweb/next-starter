import { type VariantProps } from "class-variance-authority";
import type { ComponentPropsWithoutRef } from "react";

import { cn } from "@/lib/cn";

import { createTextVariants } from "./textVariants";

const pageTitleVariants = createTextVariants("tracking-tight");

/** h1 の印(data-slot)。admin-page-title は上流の管理の見出し部品が渡す(fork は名前を変えずに印を狙う) */
export type PageTitleSlot = "page-title" | "admin-page-title";

export type PageTitleProps = Omit<ComponentPropsWithoutRef<"h1">, "slot"> &
  VariantProps<typeof pageTitleVariants> & {
    /** 印の名前(上流の包む部品だけが使う。既定 page-title)。props の data-slot はこれに負ける */
    slot?: PageTitleSlot;
  };

export function PageTitle({
  tone = "inherit",
  size = "xxl",
  align = "left",
  weight = "bold",
  srOnly = false,
  className,
  children,
  slot = "page-title",
  ...props
}: PageTitleProps) {
  return (
    <h1
      className={cn(
        pageTitleVariants({ tone, size, align, weight, srOnly }),
        className,
      )}
      {...props}
      data-slot={slot}
    >
      {children}
    </h1>
  );
}
