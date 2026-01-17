import { cva, type VariantProps } from "class-variance-authority";
import { ComponentPropsWithoutRef } from "react";

import { cn } from "@/lib/cn";

import {
  appearance,
  padding,
  paddingBlock,
  paddingInline,
  margin,
  marginBlock,
  marginInline,
} from "./commonVariants";

const flexVariantDefinitions = {
  gap: {
    none: "gap-0",
    xs: "gap-2",
    sm: "gap-4",
    md: "gap-6",
    lg: "gap-8",
    xl: "gap-12",
    xxl: "gap-16",
  },
  direction: {
    row: "flex-row",
    column: "flex-col",
    columnToRowSm: "flex-col sm:flex-row",
  },
  align: {
    stretch: "items-stretch",
    start: "items-start",
    center: "items-center",
    end: "items-end",
    centerToStartSm: "items-center sm:items-start",
  },
  justify: {
    start: "justify-start",
    end: "justify-end",
    center: "justify-center",
    between: "justify-between",
    centerToStartSm: "justify-center sm:justify-start",
  },
  wrap: {
    nowrap: "flex-nowrap",
    wrap: "flex-wrap",
  },
} as const;

/** Flex用のレイアウトバリアント（spaceを除外） */
const flexLayoutVariants = {
  appearance,
  padding,
  paddingBlock,
  paddingInline,
  margin,
  marginBlock,
  marginInline,
} as const;

const flexVariants = cva("flex", {
  variants: {
    ...flexLayoutVariants,
    ...flexVariantDefinitions,
  },
});

type FlexProps = Omit<ComponentPropsWithoutRef<"div">, "className"> &
  VariantProps<typeof flexVariants> & {
    className?: string;
  };

export function Flex({
  appearance,
  padding,
  paddingBlock,
  paddingInline,
  margin,
  marginBlock,
  marginInline,
  gap = "none",
  direction = "row",
  align = "stretch",
  justify = "start",
  wrap = "nowrap",
  className,
  ...props
}: FlexProps) {
  const variantClasses = flexVariants({
    appearance,
    padding,
    paddingBlock,
    paddingInline,
    margin,
    marginBlock,
    marginInline,
    gap,
    direction,
    align,
    justify,
    wrap,
  });

  return <div className={cn(variantClasses, className)} {...props} />;
}
