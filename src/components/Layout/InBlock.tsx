import { type VariantProps } from "class-variance-authority";
import type { ComponentProps } from "react";

import { cn } from "@/lib/cn";
import { boxSpacingClassName, type BoxSpacingProps } from "@/lib/spacing";

import { createLayoutVariants } from "./appearance";

const inBlockVariants = createLayoutVariants("inline-block");

type InBlockProps = ComponentProps<"span"> & VariantProps<typeof inBlockVariants> & BoxSpacingProps;

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
        inBlockVariants({ appearance }),
        boxSpacingClassName({ padding, paddingBlock, paddingInline, margin, marginBlock, marginInline }),
        className,
      )}
    />
  );
}
