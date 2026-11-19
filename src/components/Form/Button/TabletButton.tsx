// src/components/Form/Button/TabletButton.tsx

"use client";

import * as React from "react";

import { Button as PrimitiveButton } from "@/components/Primitives/Button";
import { cn } from "@/lib/cn";

import { resolveButtonLoading, type ButtonLoadingProps } from "./Button";
import { tabletButtonVariants, type TabletButtonStyleProps } from "./tablet-button-variants";

export type TabletButtonProps = React.ComponentPropsWithoutRef<typeof PrimitiveButton> &
  TabletButtonStyleProps & {
    /** クリックイベントを親要素に伝播させるか @default false */
    propagateClick?: boolean;
  } & ButtonLoadingProps;

const TabletButton = React.forwardRef<HTMLButtonElement, TabletButtonProps>(
  (
    {
      className,
      variant,
      size,
      fullWidth,
      propagateClick = false,
      onClick,
      loading,
      loadingLabel,
      ...props
    },
    ref,
  ) => {
    const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
      if (!propagateClick) {
        e.stopPropagation();
      }
      onClick?.(e);
    };

    return (
      <PrimitiveButton
        ref={ref}
        className={cn(tabletButtonVariants({ variant, size, fullWidth, className }))}
        onClick={handleClick}
        {...props}
        {...resolveButtonLoading({ loading, loadingLabel, ...props })}
      />
    );
  },
);

TabletButton.displayName = "TabletButton";

export { TabletButton, tabletButtonVariants };
