// src/components/Primitives/HoverCard/HoverCard.tsx
// radix-ui の HoverCard に印(data-slot)だけを足した薄い部品(クラスは付けない。見た目は完成品 Overlays/HoverCard が持つ)。
// 要素を描かない Root / Portal は印なし。印は呼び手の props より前に置く(呼び手の data-slot が勝つ)

"use client";

import type { ComponentProps } from "react";
import { HoverCard as HoverCardPrimitive } from "radix-ui";

export function HoverCardRoot(props: ComponentProps<typeof HoverCardPrimitive.Root>) {
  return <HoverCardPrimitive.Root {...props} />;
}

export function HoverCardTrigger(props: ComponentProps<typeof HoverCardPrimitive.Trigger>) {
  return <HoverCardPrimitive.Trigger {...props} data-slot="hover-card-trigger" />;
}

export function HoverCardPortal(props: ComponentProps<typeof HoverCardPrimitive.Portal>) {
  return <HoverCardPrimitive.Portal {...props} />;
}

export function HoverCardContent(props: ComponentProps<typeof HoverCardPrimitive.Content>) {
  return <HoverCardPrimitive.Content {...props} data-slot="hover-card-content" />;
}

export function HoverCardArrow(props: ComponentProps<typeof HoverCardPrimitive.Arrow>) {
  return <HoverCardPrimitive.Arrow {...props} data-slot="hover-card-arrow" />;
}
