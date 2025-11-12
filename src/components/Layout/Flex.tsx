import { type VariantProps } from "class-variance-authority";
import { ComponentPropsWithoutRef } from "react";

import { cn } from "@/lib/cn";

import { createLayoutVariants } from "./commonVariants";

const flexVariants = createLayoutVariants("flex", {
  variants: {
    gap: {
      none: "gap-0",
      xs: "gap-1",
      sm: "gap-2",
      md: "gap-4",
      lg: "gap-6",
      xl: "gap-8",
      "2xl": "gap-16",
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
      center: "justify-center",
      between: "justify-between",
      centerToStartSm: "justify-center sm:justify-start",
    },
    wrap: {
      nowrap: "flex-nowrap",
      wrap: "flex-wrap",
    },
  },
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
    direction: "row",
    align: "stretch",
    justify: "start",
    wrap: "nowrap",
  },
});

type FlexProps = Omit<ComponentPropsWithoutRef<"div">, "className"> &
  VariantProps<typeof flexVariants> & {
    className?: string;
  };

export function Flex({
  visualEffect,
  space,
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
  className,
  ...props
}: FlexProps) {
  return (
    <div
      className={cn(
        flexVariants({
          visualEffect,
          space,
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
        }),
        className,
      )}
      {...props}
    />
  );
}
