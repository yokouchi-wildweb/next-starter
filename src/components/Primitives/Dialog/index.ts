// src/components/Primitives/Dialog/index.ts
// 入口(re-export だけ): ダイアログの低レベル部品。Radix は "radix-ui" から読む。
// 完成品(Dialog / Modal / TabbedModal / DetailModal …)は src/components/Overlays
export {
  DialogPrimitives,
  DialogPortal,
  DialogTrigger,
  DialogClose,
  DialogOverlay,
  DialogContent,
  DialogTitle,
  DialogHeader,
  DialogFooter,
  DialogDescription,
  FALLBACK_DIALOG_TITLE,
} from "./Dialog";
