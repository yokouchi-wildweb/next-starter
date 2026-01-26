// src/components/Form/Button/Button.tsx

"use client";

import * as React from "react";

import { Button as ShadcnButton } from "@/components/_shadcn/button";
import { cn } from "@/lib/cn";

import { buttonVariants, type ButtonStyleProps } from "./button-variants";

export type ButtonProps = React.ComponentPropsWithoutRef<typeof ShadcnButton> &
  ButtonStyleProps & {
    /** クリックイベントを親要素に伝播させるか @default false */
    propagateClick?: boolean;
  };

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, opticalAdjust, propagateClick = false, onClick, ...props }, ref) => {
    const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
      if (!propagateClick) {
        e.stopPropagation();
      }
      onClick?.(e);
    };

    return (
      <ShadcnButton
        ref={ref}
        className={cn(buttonVariants({ variant, size, opticalAdjust, className }))}
        onClick={handleClick}
        {...props}
      />
    );
  },
);

Button.displayName = "FormButton";

export { Button, buttonVariants };
export type { ButtonStyleProps };
