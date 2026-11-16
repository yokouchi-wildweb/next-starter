import { cva, type VariantProps } from "class-variance-authority";
import type { ComponentProps } from "react";

import { cn } from "@/lib/cn";

import { layoutVariants } from "./commonVariants";
import { boxSpacingClassName, spacingClassName, type BoxSpacingProps, type SpacingValue } from "./spacing";

const gridVariantDefinitions = {
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

const gridLayoutVariants = cva("grid", { variants: layoutVariants });
const gridVariants = cva("", { variants: gridVariantDefinitions });

type GridProps =
  Omit<ComponentProps<"div">, "className"> &
  VariantProps<typeof gridLayoutVariants> &
  VariantProps<typeof gridVariants> &
  BoxSpacingProps & {
    /** セルの間の余白(段の名前 / 幅別。既定 none = 0) */
    gap?: SpacingValue | null;
    /** 列の間(横)の余白。gap より後に効く */
    gapX?: SpacingValue | null;
    /** 行の間(縦)の余白。gap より後に効く */
    gapY?: SpacingValue | null;
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
  gapX,
  gapY,
  columns,
  rows,
  autoFlow = "row",
  alignItems = "stretch",
  justifyItems = "stretch",
  justifyContent = "start",
  className,
  ...props

}: GridProps) {
  // 並びは旧来の class の順(grid → 見た目 → 余白 → gap → 配置)を保つ
  const variantClasses = cn(
    gridLayoutVariants({ appearance }),
    boxSpacingClassName({ padding, paddingBlock, paddingInline, margin, marginBlock, marginInline }),
    spacingClassName("gap", gap),
    spacingClassName("gapX", gapX),
    spacingClassName("gapY", gapY),
    gridVariants({ columns, rows, autoFlow, alignItems, justifyItems, justifyContent }),
  );

  return <div data-component="Grid" className={cn(variantClasses, className)} {...props} />;
}
