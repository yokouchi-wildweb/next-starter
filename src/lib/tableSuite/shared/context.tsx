// src/lib/tableSuite/shared/context.tsx

"use client";

import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

export const tableVariants = cva("w-full caption-bottom text-sm", {
  variants: {
    variant: {
      default: "",
      list: "min-w-full border border-border",
    },
  },
  defaultVariants: { variant: "default" },
});

export const headerVariants = cva("[&_tr]:border-b", {
  variants: {
    variant: {
      default: "",
      list: "bg-muted",
    },
  },
  defaultVariants: { variant: "default" },
});

export const rowVariants = cva("border-b transition-colors data-[state=selected]:bg-muted", {
  variants: {
    variant: {
      default: "",
      list: "even:bg-muted/50",
    },
    hoverEffect: {
      enabled: "hover:bg-accent/20",
      disabled: "hover:bg-transparent",
    },
  },
  defaultVariants: { variant: "default", hoverEffect: "enabled" },
});

export const headVariants = cva(
  "text-foreground align-middle font-medium whitespace-nowrap [&:has([role=checkbox])]:pr-0 [&>[role=checkbox]]:translate-y-[2px]",
  {
    variants: {
      variant: {
        default: "h-10 px-2 text-center",
        list: "px-2 py- border-b text-center",
      },
    },
    defaultVariants: { variant: "default" },
  },
);

export const cellVariants = cva(
  "align-middle whitespace-nowrap [&:has([role=checkbox])]:pr-0 [&>[role=checkbox]]:translate-y-[2px]",
  {
    variants: {
      variant: {
        default: "",
        list: "border-b",
      },
    },
    defaultVariants: { variant: "default" },
  },
);

export const TableContext = React.createContext<{ variant: VariantProps<typeof tableVariants>["variant"] }>({
  variant: "default",
});
