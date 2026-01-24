// src/components/Overlays/Popover/index.ts

// Primitives
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
} from "./PopoverPrimitives";

// High-level components
export { Popover, type PopoverProps } from "./Popover";
export { ConfirmPopover, type ConfirmPopoverProps } from "./ConfirmPopover";
export { PromptPopover, type PromptPopoverProps } from "./PromptPopover";
export { ActionPopover, type ActionPopoverItem, type ActionPopoverProps } from "./ActionPopover";
export { InfoPopover, type InfoPopoverProps } from "./InfoPopover";
