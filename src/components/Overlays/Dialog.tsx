// src/components/Overlays/Dialog.tsx

"use client";

import type { ComponentProps, CSSProperties } from "react";

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
} from "@/components/_shadcn/dialog";
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
  maxWidth?: number | string;
  minHeight?: number | string;
  maxHeight?: number | string;
  height?: number | string;
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
  maxWidth,
  minHeight,
  maxHeight,
  height,
  style,
  ...props
}: DialogContentProps) {
  const resolvedMaxWidth = typeof maxWidth === "number" ? `${maxWidth}px` : maxWidth;
  const resolvedMinHeight = typeof minHeight === "number" ? `${minHeight}px` : minHeight;
  const resolvedMaxHeight = typeof maxHeight === "number" ? `${maxHeight}px` : maxHeight;
  const resolvedHeight = typeof height === "number" ? `${height}px` : height;
  const contentStyle: CSSProperties | undefined =
    resolvedMaxWidth || resolvedMinHeight || resolvedMaxHeight || resolvedHeight
      ? {
          ...style,
          ...(resolvedMaxWidth ? { maxWidth: resolvedMaxWidth } : {}),
          ...(resolvedMinHeight ? { minHeight: resolvedMinHeight } : {}),
          ...(resolvedMaxHeight ? { maxHeight: resolvedMaxHeight } : {}),
          ...(resolvedHeight ? { height: resolvedHeight } : {}),
        }
      : style;

  return (
    <BaseDialogContent
      className={className}
      showCloseButton={showCloseButton}
      layerClassName={cn(CONTENT_LAYER_CLASS[layer], layerClassName)}
      overlayLayerClassName={cn(OVERLAY_LAYER_CLASS[overlayLayer], overlayLayerClassName)}
      style={contentStyle}
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
