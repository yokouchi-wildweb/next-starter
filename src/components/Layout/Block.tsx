
import { cva, type VariantProps } from "class-variance-authority";
import type { ComponentPropsWithoutRef } from "react";

import { cn } from "@/lib/cn";

import { layoutVariants } from "./commonVariants";

const blockVariants = cva("block mx-auto my-2", {
  variants: {
    ...layoutVariants,
  },
  defaultVariants: {
    variant: "default",
    space: "md",
  },
});

type BlockProps = ComponentPropsWithoutRef<"div"> & VariantProps<typeof blockVariants>;

export function Block({ variant, space, className, ...props }: BlockProps) {
  return <div {...props} className={cn(blockVariants({ variant, space }), className)} />;
}
