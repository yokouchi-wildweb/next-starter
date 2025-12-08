// src/components/Form/Button/LinkButton.tsx

import Link from "next/link";
import type { ComponentPropsWithoutRef } from "react";

import { baseButtonClassName } from "@/components/_shadcn/button";
import { cn } from "@/lib/cn";

import { buttonVariants, type ButtonStyleProps } from "./button-variants";

export type LinkButtonProps = ComponentPropsWithoutRef<typeof Link> & ButtonStyleProps;

export function LinkButton({
  variant,
  size,
  className,
  ...props
}: LinkButtonProps) {
  return (
    <Link
      className={cn(baseButtonClassName, buttonVariants({ variant, size }), className)}
      {...props}
    />
  );
}
