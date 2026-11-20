// src/components/Button/Button.tsx

"use client";

import * as React from "react";

import { Spinner } from "@/components/Overlays/Loading/Spinner";
import { Button as PrimitiveButton, type ButtonSlot } from "@/components/Primitives/Button";
import { cn } from "@/lib/cn";

import { buttonVariants, type ButtonStyleProps } from "./variants";

export type ButtonProps = React.ComponentPropsWithoutRef<typeof PrimitiveButton> &
  ButtonStyleProps & {
    /** クリックイベントを親要素に伝播させるか @default false */
    propagateClick?: boolean;
    /** 印(data-slot)の名前。上流の包む部品だけが使う(既定 button)。props の data-slot はこれに負ける */
    slot?: ButtonSlot;
  } & ButtonLoadingProps;

/** 読み込み中の指定(Button / TabletButton 共通)。渡さなければ今の出力のまま */
export type ButtonLoadingProps = {
  /** 読み込み中: 押せなくし(disabled)、aria-busy を付け、子の前に Spinner を出す。asChild のときは Spinner を足さない @default false */
  loading?: boolean;
  /** 読み込み中に子の代わりに出す中身(例「保存中...」)。未指定 = 子のまま、null = Spinner だけ */
  loadingLabel?: React.ReactNode;
};

/**
 * loading の指定を button の disabled / aria-busy / 子へ写す(props の後ろに広げる上書き)。
 * loading でないときは何も返さない(呼び手の props の並びのまま = 出力が前と同じ)。asChild のときは子に手を入れない: Slot は子 1 つ
 */
export function resolveButtonLoading({
  loading = false,
  loadingLabel,
  asChild,
  children,
}: ButtonLoadingProps & { asChild?: boolean; children?: React.ReactNode }) {
  if (!loading) return {};
  return {
    disabled: true,
    "aria-busy": true as const,
    children: asChild ? (
      children
    ) : (
      <>
        <Spinner />
        {loadingLabel === undefined ? children : loadingLabel}
      </>
    ),
  };
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant,
      size,
      opticalAdjust,
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
        className={cn(buttonVariants({ variant, size, opticalAdjust, className }))}
        onClick={handleClick}
        {...props}
        {...resolveButtonLoading({ loading, loadingLabel, ...props })}
      />
    );
  },
);

Button.displayName = "Button";

export { Button };
