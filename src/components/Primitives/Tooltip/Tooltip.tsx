// src/components/Primitives/Tooltip/Tooltip.tsx
// radix-ui の Tooltip に印(data-slot)だけを足した薄い部品(クラスは付けない。見た目は完成品 Overlays/Tooltip が持つ)。
// 要素を描かない Provider / Root / Portal は印なし。印は呼び手の props より前に置く(呼び手の data-slot が勝つ)

"use client";

import type { ComponentProps } from "react";
import { Tooltip as TooltipPrimitive } from "radix-ui";

export function TooltipProvider(props: ComponentProps<typeof TooltipPrimitive.Provider>) {
  return <TooltipPrimitive.Provider {...props} />;
}

export function TooltipRoot(props: ComponentProps<typeof TooltipPrimitive.Root>) {
  return <TooltipPrimitive.Root {...props} />;
}

export function TooltipTrigger(props: ComponentProps<typeof TooltipPrimitive.Trigger>) {
  return <TooltipPrimitive.Trigger data-slot="tooltip-trigger" {...props} />;
}

export function TooltipPortal(props: ComponentProps<typeof TooltipPrimitive.Portal>) {
  return <TooltipPrimitive.Portal {...props} />;
}

export function TooltipContent(props: ComponentProps<typeof TooltipPrimitive.Content>) {
  return <TooltipPrimitive.Content data-slot="tooltip-content" {...props} />;
}

export function TooltipArrow(props: ComponentProps<typeof TooltipPrimitive.Arrow>) {
  return <TooltipPrimitive.Arrow data-slot="tooltip-arrow" {...props} />;
}
