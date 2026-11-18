// src/components/Primitives/Dialog/Dialog.tsx

"use client";

import { type ComponentProps, type CSSProperties } from "react";
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
} from "./DialogBase";
import { cn } from "@/lib/cn";
import { zLayerClass } from "@/lib/zLayer";
import { isToastTarget } from "@/lib/toast";

/** 浮く物の層はいつも floating(当議会 D189・D190: 層を選べない、同じ層では後に開いた物が上) */
const FLOATING_LAYER_CLASS = zLayerClass("floating");

/** fullscreen の本体の class(中央寄せ・最大幅・角丸・枠・内側の余白を外し、上下に safe-area の余白)。
 * 呼び手の className はこの後に足す(中身の余白は呼び手が決める) */
const FULLSCREEN_CLASS =
  "inset-0 top-0 left-0 translate-x-0 translate-y-0 max-w-none sm:max-w-none max-h-none rounded-none border-0 p-0 pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)] shadow-none";
/** fullscreen の閉じるボタン(角から半分はみ出す既定の位置だと画面の外に出るため、内側の右上へ) */
const FULLSCREEN_CLOSE_BUTTON_CLASS =
  "top-[calc(env(safe-area-inset-top)+0.75rem)] right-3 translate-x-0 sm:translate-x-0 translate-y-0";

/** title 省略時に Dialog / Modal が sr-only で描画する既定のアクセシブルネーム。
 * Radix Dialog は DialogTitle 必須（無いとコンソールエラー + role="dialog" が無名になる）。 */
export const FALLBACK_DIALOG_TITLE = "ダイアログ";

type DialogOverlayProps = Omit<ComponentProps<typeof BaseDialogOverlay>, "layerClassName">;

type DialogContentProps = Omit<
  ComponentProps<typeof BaseDialogContent>,
  "layerClassName" | "overlayLayerClassName"
> & {
  showCloseButton?: boolean;
  /** 閉じるボタンに足す class(既定は本体の右上の角に半分はみ出す位置) */
  closeButtonClassName?: string;
  /** 全画面: 本体が画面いっぱい(角丸・枠・最大幅・内側の余白なし、高さ 100dvh。container があれば h-full)。
   * 余白は上下の safe-area の分だけ、閉じるボタンは内側の右上。maxWidth は効かない */
  fullscreen?: boolean;
  maxWidth?: number | string;
  minHeight?: number | string;
  maxHeight?: number | string;
  height?: number | string;
};

export function DialogOverlay({ className, ...props }: DialogOverlayProps) {
  return (
    <BaseDialogOverlay
      className={className}
      layerClassName={FLOATING_LAYER_CLASS}
      {...props}
    />
  );
}

export function DialogContent({
  className,
  children,
  showCloseButton = true,
  closeButtonClassName,
  fullscreen = false,
  maxWidth,
  minHeight,
  maxHeight,
  height,
  style,
  onInteractOutside,
  ...props
}: DialogContentProps) {
  const resolvedMaxWidth =
    maxWidth !== undefined && !fullscreen
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
      className={cn(
        "[&>*]:min-w-0",
        fullscreen && FULLSCREEN_CLASS,
        fullscreen && (props.container ? "h-full" : "h-[100dvh]"),
        className,
      )}
      showCloseButton={false}
      layerClassName={FLOATING_LAYER_CLASS}
      overlayLayerClassName={FLOATING_LAYER_CLASS}
      style={contentStyle}
      onInteractOutside={(event) => {
        // トーストの中の押しは外押しにしない(トーストは浮く物より上の toast の層。押して消すとき開いているモーダルを閉じない、当議会 D189)
        if (isToastTarget(event.target)) {
          event.preventDefault();
          return;
        }
        onInteractOutside?.(event);
      }}
      {...props}
    >
      {children}
      {showCloseButton && (
        <BaseDialogClose
          className={cn(
            "absolute top-0 right-0 translate-x-[calc(50%-6px)] sm:translate-x-1/2 -translate-y-1/2 rounded-full bg-foreground p-2 text-background hover:bg-foreground/80 transition-colors cursor-pointer",
            fullscreen && FULLSCREEN_CLOSE_BUTTON_CLASS,
            closeButtonClassName,
          )}
        >
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
