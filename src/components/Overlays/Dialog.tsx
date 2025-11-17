// src/components/Overlays/Dialog.tsx

"use client";

import type { ComponentProps } from "react";

import {
  Dialog as BaseDialog,
  DialogTrigger as BaseDialogTrigger,
  DialogPortal as BaseDialogPortal,
  DialogOverlay as BaseDialogOverlay,
  DialogClose as BaseDialogClose,
  DialogContent as BaseDialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
} from "@/components/Shadcn/dialog";
import { cn } from "@/lib/cn";

type OverlayLayer =
  | "backdrop"
  | "modal"
  | "overlay"
  | "alert"
  | "super"
  | "ultimate"
  | "apex";

type ContentLayer = "modal" | "alert" | "super" | "ultimate" | "apex";

const OVERLAY_LAYER_CLASS: Record<OverlayLayer, string> = {
  backdrop: "backdrop-layer",
  modal: "modal-layer",
  overlay: "overlay-layer",
  alert: "alert-layer",
  super: "super-layer",
  ultimate: "ultimate-layer",
  apex: "apex-layer",
};

const CONTENT_LAYER_CLASS: Record<ContentLayer, string> = {
  modal: "modal-layer",
  alert: "alert-layer",
  super: "super-layer",
  ultimate: "ultimate-layer",
  apex: "apex-layer",
};

type DialogOverlayProps = Omit<ComponentProps<typeof BaseDialogOverlay>, "layerClassName"> & {
  layer?: OverlayLayer;
  layerClassName?: string;
};

type DialogContentProps = Omit<
  ComponentProps<typeof BaseDialogContent>,
  "layerClassName" | "overlayLayerClassName"
> & {
  layer?: ContentLayer;
  overlayLayer?: OverlayLayer;
  showCloseButton?: boolean;
  layerClassName?: string;
  overlayLayerClassName?: string;
};

export function DialogOverlay({
  layer = "modal",
  className,
  layerClassName,
  ...props
}: DialogOverlayProps) {
  return (
    <BaseDialogOverlay
      className={className}
      layerClassName={cn(OVERLAY_LAYER_CLASS[layer], layerClassName)}
      {...props}
    />
  );
}

export function DialogContent({
  className,
  children,
  showCloseButton = true,
  layer = "modal",
  overlayLayer = "modal",
  layerClassName,
  overlayLayerClassName,
  ...props
}: DialogContentProps) {
  return (
    <BaseDialogContent
      className={className}
      showCloseButton={showCloseButton}
      layerClassName={cn(CONTENT_LAYER_CLASS[layer], layerClassName)}
      overlayLayerClassName={cn(OVERLAY_LAYER_CLASS[overlayLayer], overlayLayerClassName)}
      {...props}
    >
      {children}
    </BaseDialogContent>
  );
}

export const Dialog = BaseDialog;
export const DialogPortal = BaseDialogPortal;
export const DialogTrigger = BaseDialogTrigger;
export const DialogClose = BaseDialogClose;

export { DialogHeader, DialogFooter, DialogTitle, DialogDescription };
