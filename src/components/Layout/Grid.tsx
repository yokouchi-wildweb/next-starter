import { cva, type VariantProps } from "class-variance-authority";
import type { ComponentPropsWithoutRef } from "react";

import { cn } from "@/lib/cn";

import { layoutVariants } from "./commonVariants";

const gridVariantDefinitions = {
  gap: {
    none: "gap-0",
    xs: "gap-1",
    sm: "gap-2",
    md: "gap-4",
    lg: "gap-6",
    xl: "gap-8",
    xxl: "gap-12",
  },
  columnGap: {
    none: "",
    xs: "gap-x-1",
    sm: "gap-x-2",
    md: "gap-x-4",
    lg: "gap-x-6",
    xl: "gap-x-8",
    xxl: "gap-x-12",
  },
  rowGap: {
    none: "",
    xs: "gap-y-1",
    sm: "gap-y-2",
    md: "gap-y-4",
    lg: "gap-y-6",
    xl: "gap-y-8",
    xxl: "gap-y-12",
  },
  columns: {
    auto: "",
    one: "grid-cols-1",
    two: "grid-cols-2",
    three: "grid-cols-3",
    four: "grid-cols-4",
    five: "grid-cols-5",
    six: "grid-cols-6",
    twelve: "grid-cols-12",
  },
  rows: {
    auto: "",
    one: "grid-rows-1",
    two: "grid-rows-2",
    three: "grid-rows-3",
    four: "grid-rows-4",
    six: "grid-rows-6",
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

const gridVariants = cva("grid", {
  variants: {
    ...layoutVariants,
    ...gridVariantDefinitions,
  },
});

type GridProps =
  Omit<ComponentPropsWithoutRef<"div">, "className"> &
  VariantProps<typeof gridVariants> & {
    className?: string;
  };


export function Grid({
  appearance,
  padding,
  paddingBlock,
  paddingInline,
  margin,
  marginBlock,
  marginInline,
  gap = "none",
  columnGap,
  rowGap,
  columns,
  rows,
  autoFlow = "row",
  alignItems = "stretch",
  justifyItems = "stretch",
  justifyContent = "start",
  className,
  ...props

}: GridProps) {
  const variantClasses = gridVariants({
    appearance,
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
  });

  return <div data-component="Grid" className={cn(variantClasses, className)} {...props} />;
}
