// src/components/Overlays/Popover/index.ts

// Primitives(低レベル部品。本体は @/components/Primitives/Popover)
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
} from "@/components/Primitives/Popover";

// High-level components
export { Popover, type PopoverProps } from "./Popover";
export { ConfirmPopover, type ConfirmPopoverProps } from "./ConfirmPopover";
export { PromptPopover, type PromptPopoverProps } from "./PromptPopover";
export { ActionPopover, type ActionPopoverItem, type ActionPopoverProps } from "./ActionPopover";
export { InfoPopover, type InfoPopoverProps } from "./InfoPopover";
export { ChecklistPopover, type ChecklistPopoverProps, type ChecklistOption } from "./ChecklistPopover";
export { SelectPopover, type SelectPopoverProps, type SelectOption } from "./SelectPopover";
export { PopoverAsyncContent, type PopoverAsyncContentProps } from "./PopoverAsyncContent";
