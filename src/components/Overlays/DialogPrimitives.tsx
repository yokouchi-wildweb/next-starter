// src/components/Overlays/DialogPrimitives.tsx

"use client";

import { createContext, useContext, type ComponentProps, type CSSProperties } from "react";
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

export type DialogOverlayLayer =
  | "backdrop"
  | "modal"
  | "overlay"
  | "alert"
  | "super"
  | "ultimate"
  | "apex";

export type DialogContentLayer = "modal" | "alert" | "super" | "ultimate" | "apex";

const OVERLAY_LAYER_CLASS: Record<DialogOverlayLayer, string> = {
  backdrop: "backdrop-layer",
  modal: "modal-layer",
  overlay: "overlay-layer",
  alert: "alert-layer",
  super: "super-layer",
  ultimate: "ultimate-layer",
  apex: "apex-layer",
};

/** 「Dialog（DialogContent）の React ツリー内に居るか」を子孫へ伝える context。
 * Popover 等がポータル可否を決めるのに使う（Radix Dialog の react-remove-scroll は
 * body 直下ポータルの wheel/touch を食うため、入れ子時は非ポータルにする必要がある）。
 * DOM 位置を ref で読む判定は初回 render で null になり defaultOpen 等で誤判定するため、
 * React ツリーで同期的に判定する。ポータル越しでも context は届く。 */
const DialogNestingContext = createContext(false);

/** 現在のコンポーネントが DialogContent の子孫（React ツリー上）なら true */
export function useIsNestedInDialog(): boolean {
  return useContext(DialogNestingContext);
}

/** title 省略時に Dialog / Modal が sr-only で描画する既定のアクセシブルネーム。
 * Radix Dialog は DialogTitle 必須（無いとコンソールエラー + role="dialog" が無名になる）。 */
export const FALLBACK_DIALOG_TITLE = "ダイアログ";

const CONTENT_LAYER_CLASS: Record<DialogContentLayer, string> = {
  modal: "modal-layer",
  alert: "alert-layer",
  super: "super-layer",
  ultimate: "ultimate-layer",
  apex: "apex-layer",
};

type DialogOverlayProps = Omit<ComponentProps<typeof BaseDialogOverlay>, "layerClassName"> & {
  layer?: DialogOverlayLayer;
  layerClassName?: string;
};

type DialogContentProps = Omit<
  ComponentProps<typeof BaseDialogContent>,
  "layerClassName" | "overlayLayerClassName"
> & {
  layer?: DialogContentLayer;
  overlayLayer?: DialogOverlayLayer;
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
      className={cn("[&>*]:min-w-0", className)}
      showCloseButton={false}
      layerClassName={cn(CONTENT_LAYER_CLASS[layer], layerClassName)}
      overlayLayerClassName={cn(OVERLAY_LAYER_CLASS[overlayLayer], overlayLayerClassName)}
      style={contentStyle}
      {...props}
    >
      <DialogNestingContext.Provider value={true}>{children}</DialogNestingContext.Provider>
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
