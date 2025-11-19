// src/components/Tables/DataTable/Table/context.tsx

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

export const rowVariants = cva("border-b transition-colors hover:bg-cyan-200/30 data-[state=selected]:bg-muted", {
  variants: {
    variant: {
      default: "",
      list: "even:bg-muted/50",
    },
  },
  defaultVariants: { variant: "default" },
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
        default: "p-2",
        list: "px-2 py-2 border-b",
      },
    },
    defaultVariants: { variant: "default" },
  },
);

export const TableContext = React.createContext<{ variant: VariantProps<typeof tableVariants>["variant"] }>({
  variant: "default",
});
