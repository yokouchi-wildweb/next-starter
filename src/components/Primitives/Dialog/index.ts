// src/components/Primitives/Dialog/index.ts
// 入口(re-export だけ): ダイアログの低レベル部品(旧 Overlays/DialogPrimitives + _shadcn/dialog)。Radix は "radix-ui" から読む。
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
  useIsNestedInDialog,
  FALLBACK_DIALOG_TITLE,
  type DialogOverlayLayer,
  type DialogContentLayer,
} from "./Dialog";
