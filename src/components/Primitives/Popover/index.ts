// src/components/Primitives/Popover/index.ts
// 入口(re-export だけ): ポップオーバーの低レベル部品(旧 Overlays/Popover/PopoverPrimitives)。Radix は "radix-ui" から読む。
// 完成品(Popover / ConfirmPopover …)は src/components/Overlays/Popover(その入口もこの名前を再輸出する)
export {
  PopoverRoot,
  PopoverTrigger,
  PopoverAnchor,
  PopoverArrow,
  PopoverClose,
  PopoverContent,
  PopoverHeader,
  PopoverTitle,
  PopoverDescription,
  PopoverBody,
  PopoverFooter,
  type PopoverLayer,
  type PopoverSize,
  type PopoverContentProps,
} from "./Popover";
