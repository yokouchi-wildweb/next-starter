// src/components/Form/Button/PseudoButton.tsx

import * as React from "react";

import { baseButtonClassName } from "@/components/_shadcn/button";
import { cn } from "@/lib/cn";

import { buttonVariants, type ButtonStyleProps } from "./button-variants";
import type { ButtonProps } from "./Button";

type PseudoButtonProps = ButtonProps;

const isSpaceKey = (key: string) => key === " " || key === "Spacebar";

export const PseudoButton = React.forwardRef<HTMLDivElement, PseudoButtonProps>(
  (
    {
      className,
      variant,
      size,
      opticalAdjust,
      disabled,
      onClick,
      onKeyDown,
      onKeyUp,
      tabIndex,
      type: _type, // divでは使用しないが、Button互換のため受け取る
      asChild: _asChild, // Shadcn互換のため受け取りのみ
      ...rest
    },
    ref,
  ) => {
    const spacePressedRef = React.useRef(false);
    const isDisabled = Boolean(disabled);

    const handleActivation = React.useCallback(
      (event: React.SyntheticEvent<HTMLElement>) => {
        if (isDisabled) return;
        onClick?.(event as unknown as React.MouseEvent<HTMLButtonElement>);
      },
      [isDisabled, onClick],
    );

    const handleKeyDown = React.useCallback(
      (event: React.KeyboardEvent<HTMLDivElement>) => {
        onKeyDown?.(event as unknown as React.KeyboardEvent<HTMLButtonElement>);
        if (event.defaultPrevented || isDisabled) return;

        if (event.key === "Enter") {
          event.preventDefault();
          handleActivation(event);
          return;
        }

        if (isSpaceKey(event.key)) {
          event.preventDefault();
          spacePressedRef.current = true;
        }
      },
      [handleActivation, isDisabled, onKeyDown],
    );

    const handleKeyUp = React.useCallback(
      (event: React.KeyboardEvent<HTMLDivElement>) => {
        onKeyUp?.(event as unknown as React.KeyboardEvent<HTMLButtonElement>);
        if (event.defaultPrevented || isDisabled) return;

        if (isSpaceKey(event.key) && spacePressedRef.current) {
          event.preventDefault();
          spacePressedRef.current = false;
          handleActivation(event);
        }
      },
      [handleActivation, isDisabled, onKeyUp],
    );

    const handleClick = React.useCallback(
      (event: React.MouseEvent<HTMLDivElement>) => {
        if (isDisabled) {
          event.preventDefault();
          event.stopPropagation();
          return;
        }
        onClick?.(event as unknown as React.MouseEvent<HTMLButtonElement>);
      },
      [isDisabled, onClick],
    );

    const resolvedTabIndex = isDisabled ? -1 : tabIndex ?? 0;
    const divCompatibleProps = rest as React.HTMLAttributes<HTMLDivElement>;

    return (
      <div
        ref={ref}
        role="button"
        tabIndex={resolvedTabIndex}
        aria-disabled={isDisabled}
        data-slot="button"
        className={cn(
          baseButtonClassName,
          buttonVariants({ variant, size, opticalAdjust, className }),
          isDisabled && "pointer-events-none cursor-not-allowed opacity-50",
        )}
        onClick={handleClick}
        onKeyDown={handleKeyDown}
        onKeyUp={handleKeyUp}
        {...divCompatibleProps}
      />
    );
  },
);

PseudoButton.displayName = "PseudoButton";

export type { PseudoButtonProps };
