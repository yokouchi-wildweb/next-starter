import type { ComponentPropsWithoutRef } from "react";

import { cn } from "@/lib/cn";

import {
  BaseLayoutVariantProps,
  ComposeLayoutVariantProps,
  createLayoutVariants,
} from "./commonVariants";

const gridVariantDefinitions = {
  gap: {
    none: "gap-0",
    xs: "gap-1",
    sm: "gap-2",
    md: "gap-4",
    lg: "gap-6",
    xl: "gap-8",
    "2xl": "gap-12",
  },
  columnGap: {
    none: "",
    xs: "gap-x-1",
    sm: "gap-x-2",
    md: "gap-x-4",
    lg: "gap-x-6",
    xl: "gap-x-8",
    "2xl": "gap-x-12",
  },
  rowGap: {
    none: "",
    xs: "gap-y-1",
    sm: "gap-y-2",
    md: "gap-y-4",
    lg: "gap-y-6",
    xl: "gap-y-8",
    "2xl": "gap-y-12",
  },
  columns: {
    auto: "",
    "1": "grid-cols-1",
    "2": "grid-cols-2",
    "3": "grid-cols-3",
    "4": "grid-cols-4",
    "5": "grid-cols-5",
    "6": "grid-cols-6",
    "12": "grid-cols-12",
  },
  rows: {
    auto: "",
    "1": "grid-rows-1",
    "2": "grid-rows-2",
    "3": "grid-rows-3",
    "4": "grid-rows-4",
    "6": "grid-rows-6",
  },
  autoFlow: {
    row: "grid-flow-row",
    column: "grid-flow-col",
    dense: "grid-flow-dense",
    rowDense: "grid-flow-row-dense",
    columnDense: "grid-flow-col-dense",
  },
  alignItems: {
    stretch: "items-stretch",
    start: "items-start",
    center: "items-center",
    end: "items-end",
  },
  justifyItems: {
    stretch: "justify-items-stretch",
    start: "justify-items-start",
    center: "justify-items-center",
    end: "justify-items-end",
  },
  justifyContent: {
    start: "justify-start",
    center: "justify-center",
    between: "justify-between",
    around: "justify-around",
    evenly: "justify-evenly",
    end: "justify-end",
  },
} as const;

const gridVariants = createLayoutVariants("grid", {
  variants: gridVariantDefinitions,
  defaultVariants: {
    visualEffect: "default",
    space: "none",
    padding: "none",
    paddingBlock: "none",
    paddingInline: "none",
    margin: "none",
    marginBlock: "none",
    marginInline: "none",
    gap: "none",
    columnGap: "none",
    rowGap: "none",
    columns: "auto",
    rows: "auto",
    autoFlow: "row",
    alignItems: "stretch",
    justifyItems: "stretch",
    justifyContent: "start",
  },
});

type GridProps =
  Omit<ComponentPropsWithoutRef<"div">, "className"> &
  BaseLayoutVariantProps &
  ComposeLayoutVariantProps<typeof gridVariantDefinitions> & {
    className?: string;
  };


export function Grid({
  visualEffect,
  space,
  padding,
  paddingBlock,
  paddingInline,
  margin,
  marginBlock,
  marginInline,
  gap,
  columnGap,
  rowGap,
  columns,
  rows,
  autoFlow,
  alignItems,
  justifyItems,
  justifyContent,
  className,
  ...props

}: GridProps) {
  const variantClasses = gridVariants(
    {
      visualEffect,
      space,
      padding,
      paddingBlock,
      paddingInline,
      margin,
      marginBlock,
      marginInline,
      gap,
      columnGap,
      rowGap,
      columns,
      rows,
      autoFlow,
      alignItems,
      justifyItems,
      justifyContent,
    } as Parameters<typeof gridVariants>[0],
  );

  return <div className={cn(variantClasses, className)} {...props} />;
}
