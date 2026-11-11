// src/components/Primitives/Button/Button.tsx

import * as React from "react";
import { Slot } from "radix-ui";

import { cn } from "@/lib/cn/index";
import type { CarouselButtonSlot } from "@/components/Primitives/Carousel/Carousel";

const baseButtonClassName =
  "inline-flex cursor-pointer items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-all disabled:cursor-not-allowed disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 shrink-0 [&_svg]:shrink-0 outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive";

/**
 * 枠に貸す印の名前(下のナビのメニュー項目 BottomNavMenuEntry が渡す)。印の持ち主は枠(src/app/(user)/_layout/README.md の一覧)で、
 * Primitives の一覧には載せない(export しないので slots.mjs の型つきの値の読み手も数えない)。Primitives は src/app を読まないので字面で書く
 */
type FrameButtonSlot = "bottom-nav-item";

/**
 * 印(data-slot)。button 以外は同じ要素を描く上流の部品が渡す: Carousel の前後のボタン・下のナビのメニュー項目(枠の印 bottom-nav-item)。
 * fork は名前を変えずに印を狙う
 */
export type ButtonSlot = "button" | CarouselButtonSlot | FrameButtonSlot;

const Button = React.forwardRef<
  HTMLButtonElement,
  Omit<React.ComponentPropsWithoutRef<"button">, "slot"> & {
    asChild?: boolean;
    /** 印の名前(上流の包む部品だけが使う。既定 button)。props の data-slot はこれに負ける */
    slot?: ButtonSlot;
  }
>(({ className, asChild = false, slot = "button", ...props }, ref) => {
  const Comp = asChild ? Slot.Root : "button";

  return (
    <Comp
      ref={ref}
      {...props}
      data-slot={slot}
      // className は分割代入で props から外してあるので、広げの後ろでも呼び手の値を落とさない(属性の並びを前と同じ data-slot → class に保つ)
      className={cn(baseButtonClassName, className)}
    />
  );
});

Button.displayName = "Button";

export { Button, baseButtonClassName };
