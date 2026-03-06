// src/components/Form/Button/TabletButton.tsx

"use client";

import * as React from "react";

import { Button as ShadcnButton } from "@/components/_shadcn/button";
import { cn } from "@/lib/cn";

import { tabletButtonVariants, type TabletButtonStyleProps } from "./tablet-button-variants";

export type TabletButtonProps = React.ComponentPropsWithoutRef<typeof ShadcnButton> &
  TabletButtonStyleProps & {
    /** クリックイベントを親要素に伝播させるか @default false */
    propagateClick?: boolean;
  };

const TabletButton = React.forwardRef<HTMLButtonElement, TabletButtonProps>(
  ({ className, variant, size, fullWidth, propagateClick = false, onClick, ...props }, ref) => {
    const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
      if (!propagateClick) {
        e.stopPropagation();
      }
      onClick?.(e);
    };

    return (
      <ShadcnButton
        ref={ref}
        className={cn(tabletButtonVariants({ variant, size, fullWidth, className }))}
        onClick={handleClick}
        {...props}
      />
    );
  },
);

TabletButton.displayName = "TabletButton";

export { TabletButton, tabletButtonVariants };
