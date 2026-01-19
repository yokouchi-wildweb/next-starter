import { type VariantProps } from "class-variance-authority";
import type { ComponentPropsWithoutRef } from "react";

import { cn } from "@/lib/cn";

import { createLayoutVariants } from "./commonVariants";

const inBlockVariants = createLayoutVariants("inline-block");

type InBlockProps = ComponentPropsWithoutRef<"span"> & VariantProps<typeof inBlockVariants>;

export function InBlock({
  appearance,
  padding,
  paddingBlock,
  paddingInline,
  margin,
  marginBlock,
  marginInline,
  className,
  ...props
}: InBlockProps) {
  return (
    <span
      data-component="InBlock"
      {...props}
      className={cn(
        inBlockVariants({
          appearance,
          padding,
          paddingBlock,
          paddingInline,
          margin,
          marginBlock,
          marginInline,
        }),
        className,
      )}
    />
  );
}
