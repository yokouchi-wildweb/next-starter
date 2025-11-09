// src/components/Overlays/Dialog.tsx

"use client";

import * as DialogPrimitive from "@radix-ui/react-dialog";
import type { ComponentProps } from "react";
import { XIcon } from "lucide-react";

import {
  Dialog as BaseDialog,
  DialogTrigger as BaseDialogTrigger,
  DialogPortal as BaseDialogPortal,
  DialogClose as BaseDialogClose,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
} from "@/components/Shadcn/dialog";
import { cn } from "@/lib/cn";

type OverlayLayer = "overlay" | "alert" | "super" | "ultimate" | "apex";

type ContentLayer = "modal" | "alert" | "super" | "ultimate" | "apex";

const OVERLAY_LAYER_CLASS: Record<OverlayLayer, string> = {
  overlay: "z-[var(--z-layer-overlay)]",
  alert: "z-[var(--z-layer-alert)]",
  super: "z-[var(--z-layer-super)]",
  ultimate: "z-[var(--z-layer-ultimate)]",
  apex: "z-[var(--z-layer-apex)]",
};

const CONTENT_LAYER_CLASS: Record<ContentLayer, string> = {
  modal: "z-[var(--z-layer-modal)]",
  alert: "z-[var(--z-layer-alert)]",
  super: "z-[var(--z-layer-super)]",
  ultimate: "z-[var(--z-layer-ultimate)]",
  apex: "z-[var(--z-layer-apex)]",
};

type DialogOverlayProps = ComponentProps<typeof DialogPrimitive.Overlay> & {
  layer?: OverlayLayer;
};

type DialogContentProps = ComponentProps<typeof DialogPrimitive.Content> & {
  layer?: ContentLayer;
  overlayLayer?: OverlayLayer;
  showCloseButton?: boolean;
};

export function DialogOverlay({ layer = "overlay", className, ...props }: DialogOverlayProps) {
  return (
    <DialogPrimitive.Overlay
      data-slot="dialog-overlay"
      className={cn(
        "data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 fixed inset-0 bg-black/50",
        OVERLAY_LAYER_CLASS[layer],
        className,
      )}
      {...props}
    />
  );
}

export function DialogContent({
  className,
  children,
  showCloseButton = true,
  layer = "modal",
  overlayLayer = "overlay",
  ...props
}: DialogContentProps) {
  return (
    <BaseDialogPortal data-slot="dialog-portal">
      <DialogOverlay layer={overlayLayer} />
      <DialogPrimitive.Content
        data-slot="dialog-content"
        className={cn(
          "bg-background data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 fixed top-[50%] left-[50%] grid w-full max-w-[calc(100%-2rem)] translate-x-[-50%] translate-y-[-50%] gap-4 rounded-lg border p-6 shadow-lg duration-200 sm:max-w-lg",
          CONTENT_LAYER_CLASS[layer],
          className,
        )}
        {...props}
      >
        {children}
        {showCloseButton && (
          <BaseDialogClose
            data-slot="dialog-close"
            className="ring-offset-background focus:ring-ring data-[state=open]:bg-accent data-[state=open]:text-muted-foreground absolute top-4 right-4 rounded-xs p-2 opacity-70 transition-colors transition-opacity hover:bg-accent/60 hover:opacity-100 focus:ring-2 focus:ring-offset-2 focus:outline-hidden disabled:pointer-events-none [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-6 text-lg"
          >
            <XIcon />
            <span className="sr-only">Close</span>
          </BaseDialogClose>
        )}
      </DialogPrimitive.Content>
    </BaseDialogPortal>
  );
}

export const Dialog = BaseDialog;
export const DialogPortal = BaseDialogPortal;
export const DialogTrigger = BaseDialogTrigger;
export const DialogClose = BaseDialogClose;

export { DialogHeader, DialogFooter, DialogTitle, DialogDescription };
