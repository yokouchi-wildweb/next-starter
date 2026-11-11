// src/components/Primitives/Tooltip/index.ts
// 入口(re-export だけ): 印(data-slot)を足した薄い部品と、radix-ui の Tooltip の名前空間。完成品(Tooltip / TooltipProvider / HelpTip)は src/components/Overlays/Tooltip
export { TooltipProvider, TooltipRoot, TooltipTrigger, TooltipPortal, TooltipContent, TooltipArrow } from "./Tooltip";
export { Tooltip as TooltipPrimitive } from "radix-ui";
