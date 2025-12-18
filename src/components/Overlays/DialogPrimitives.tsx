// src/components/Overlays/DialogPrimitives.tsx

"use client";

import type { ComponentProps, CSSProperties } from "react";
import { XIcon } from "lucide-react";

import {
  Dialog as BaseDialog,
  DialogTrigger as BaseDialogTrigger,
  DialogPortal as BaseDialogPortal,
  DialogOverlay as BaseDialogOverlay,
  DialogClose as BaseDialogClose,
  DialogContent as BaseDialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle as BaseDialogTitle,
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
  const resolvedMaxWidth =
    maxWidth !== undefined
      ? `min(${typeof maxWidth === "number" ? `${maxWidth}px` : maxWidth}, calc(100% - 2rem))`
      : undefined;
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
      showCloseButton={false}
      layerClassName={cn(CONTENT_LAYER_CLASS[layer], layerClassName)}
      overlayLayerClassName={cn(OVERLAY_LAYER_CLASS[overlayLayer], overlayLayerClassName)}
      style={contentStyle}
      {...props}
    >
      {children}
      {showCloseButton && (
        <BaseDialogClose className="absolute top-0 right-0 translate-x-[calc(50%-6px)] sm:translate-x-1/2 -translate-y-1/2 rounded-full bg-black p-2 text-white hover:bg-gray-800 transition-colors cursor-pointer">
          <XIcon className="size-6" />
          <span className="sr-only">閉じる</span>
        </BaseDialogClose>
      )}
    </BaseDialogContent>
  );
}

type DialogTitleProps = ComponentProps<typeof BaseDialogTitle> & {
  srOnly?: boolean;
};

export function DialogTitle({ srOnly, className, ...props }: DialogTitleProps) {
  return (
    <BaseDialogTitle
      className={cn(srOnly && "sr-only", className)}
      {...props}
    />
  );
}

export const DialogPrimitives = BaseDialog;
export const DialogPortal = BaseDialogPortal;
export const DialogTrigger = BaseDialogTrigger;
export const DialogClose = BaseDialogClose;

export { DialogHeader, DialogFooter, DialogDescription };
