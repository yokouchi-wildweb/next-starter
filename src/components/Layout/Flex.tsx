
import { cva, type VariantProps } from "class-variance-authority";
import {ComponentPropsWithoutRef} from "react";
import type { JSX } from "react";

import { cn } from "@/lib/cn";

import { layoutVariants } from "./commonVariants";

const flexVariants = cva("flex my-2", {
  variants: {
    ...layoutVariants,
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
    width: {
      auto: "",
      full: "w-full",
    },
    minHeight: {
      none: "",
      screen: "min-h-screen",
    },
  },
  defaultVariants: {
    variant: "default",
    space: "none",
    gap: "none",
    direction: "row",
    align: "stretch",
    justify: "start",
    wrap: "nowrap",
    width: "auto",
    minHeight: "none",
  },
});

type FlexElement = keyof JSX.IntrinsicElements;

type BaseFlexProps<T extends FlexElement> = Omit<ComponentPropsWithoutRef<T>, "className"> & {
  as?: T;
};

type FlexProps<T extends FlexElement = "div"> = BaseFlexProps<T> & VariantProps<typeof flexVariants> & {
    className?: string;
  };

export function Flex<T extends FlexElement = "div">({
  as,
  variant,
  space,
  gap,
  direction,
  align,
  justify,
  wrap,
  width,
  minHeight,
  className,
  ...props
}: FlexProps<T>) {
  const Component = (as ?? "div") as FlexElement;
  return (
    <Component
      className={cn(
        flexVariants({
          variant,
          space,
          gap,
          direction,
          align,
          justify,
          wrap,
          width,
          minHeight,
        }),
        className,
      )}
      {...props}
    />
  );
}
