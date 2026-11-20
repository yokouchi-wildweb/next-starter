// src/components/Overlays/Sheet/Sheet.tsx

"use client";

import { type CSSProperties, type PointerEvent, type ReactNode, useRef, useState } from "react";
import { XIcon } from "lucide-react";

import {
  DialogBareClose,
  DialogBareContent,
  DialogBareOverlay,
  DialogPrimitives,
  DialogPortal,
  DialogTitle,
  FALLBACK_DIALOG_TITLE,
} from "@/components/Primitives/Dialog";
import { cn } from "@/lib/cn";
import { isAboveFloatingTarget, zLayerClass } from "@/lib/zLayer";

/** 板の出る辺 */
export type SheetSide = "bottom" | "top" | "left" | "right";


/** 板の印(data-slot)。sheet 以外は上流の包む部品が渡す。fork は名前を変えずに印を狙う */
export type SheetSlot = "sheet" | "admin-sidebar";
/** 背景の印(data-slot) */
export type SheetOverlaySlot = "sheet-overlay" | "admin-sidebar";

export type SheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** 出る辺。@default "bottom" */
  side?: SheetSide;
  /** 題。省略時も sr-only の既定の題が入る(role="dialog" の名) */
  title?: ReactNode;
  titleSrOnly?: boolean;
  children?: ReactNode;
  /** 大きさ。bottom / top = 最大の高さ(既定 "85dvh")、left / right = 幅(既定 "20rem"、画面の幅 - 2rem まで) */
  size?: number | string;
  /** 板に足すクラス(色・角丸・余白等) */
  className?: string;
  /** 背景(覆い)に足すクラス */
  overlayClassName?: string;
  /** portal の先の要素(省略 = body)。渡すと背景と板はその要素の中で absolute に重なる */
  container?: HTMLElement | null;
  /** 本体をスクロールの箱(overflow-y-auto)にするか。@default true。
   * false = 箱は高さだけ渡し(flex-1 min-h-0)、スクロールと板の外へはみ出す物(横に開く子メニュー等)は中身が持つ */
  scrollable?: boolean;
  /** 板の内側の右上の閉じるボタン。@default true */
  showCloseButton?: boolean;
  /** side bottom のつまみ(引いて閉じる取っ手)。bottom 以外では出ない。@default true */
  handle?: boolean;
  /** つまみを下へ引いてこの距離(px)を超えて離すと閉じる。@default 120 */
  dismissDistance?: number;
  /** 板の印(上流の包む部品だけが使う)。@default "sheet" */
  slot?: SheetSlot;
  /** 背景の印。@default "sheet-overlay" */
  overlaySlot?: SheetOverlaySlot;
  onOpenAutoFocus?: (event: Event) => void;
  onCloseAutoFocus?: (event: Event) => void;
};

const SIDE_CLASS: Record<SheetSide, string> = {
  bottom:
    "inset-x-0 bottom-0 w-full rounded-t-2xl border-t data-[state=open]:slide-in-from-bottom data-[state=closed]:slide-out-to-bottom",
  top: "inset-x-0 top-0 w-full rounded-b-2xl border-b data-[state=open]:slide-in-from-top data-[state=closed]:slide-out-to-top",
  left: "inset-y-0 left-0 h-full max-w-[calc(100%-2rem)] border-r data-[state=open]:slide-in-from-left data-[state=closed]:slide-out-to-left",
  right:
    "inset-y-0 right-0 h-full max-w-[calc(100%-2rem)] border-l data-[state=open]:slide-in-from-right data-[state=closed]:slide-out-to-right",
};

const DEFAULT_SIZE: Record<SheetSide, string> = {
  bottom: "85dvh",
  top: "85dvh",
  left: "20rem",
  right: "20rem",
};

const toCssSize = (value: number | string) => (typeof value === "number" ? `${value}px` : value);

export function Sheet({
  open,
  onOpenChange,
  side = "bottom",
  title,
  titleSrOnly,
  children,
  size,
  className,
  overlayClassName,
  container,
  scrollable = true,
  showCloseButton = true,
  handle = true,
  dismissDistance = 120,
  slot = "sheet",
  overlaySlot = "sheet-overlay",
  onOpenAutoFocus,
  onCloseAutoFocus,
}: SheetProps) {
  // つまみを引いている間の下への距離(px)。null = 引いていない
  const [dragY, setDragY] = useState<number | null>(null);
  const startYRef = useRef(0);

  const vertical = side === "bottom" || side === "top";
  const resolvedSize = toCssSize(size ?? DEFAULT_SIZE[side]);
  const style: CSSProperties = {
    ...(vertical ? { maxHeight: resolvedSize } : { width: resolvedSize }),
    ...(dragY ? { transform: `translateY(${dragY}px)`, transition: "none" } : {}),
  };

  const showHandle = side === "bottom" && handle;

  // 引いて閉じる: つまみの pointer の事件だけで動かす(中身のスクロールとは競わない)
  const onHandlePointerDown = (e: PointerEvent<HTMLDivElement>) => {
    startYRef.current = e.clientY;
    e.currentTarget.setPointerCapture?.(e.pointerId);
    setDragY(0);
  };
  const onHandlePointerMove = (e: PointerEvent<HTMLDivElement>) => {
    if (dragY === null) return;
    setDragY(Math.max(0, e.clientY - startYRef.current));
  };
  const onHandlePointerEnd = () => {
    if (dragY === null) return;
    const dismiss = dragY > dismissDistance;
    setDragY(null);
    if (dismiss) onOpenChange(false);
  };

  const resolvedTitle = title || FALLBACK_DIALOG_TITLE;
  const resolvedTitleSrOnly = title ? Boolean(titleSrOnly) : true;

  return (
    <DialogPrimitives open={open} onOpenChange={onOpenChange}>
      <DialogPortal container={container}>
        <DialogBareOverlay
          className={cn(
            "data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 fixed inset-0 bg-overlay/50",
            zLayerClass("floating"),
            container && "absolute",
            overlayClassName,
          )}
          data-slot={overlaySlot}
        />
        <DialogBareContent
          className={cn(
            "bg-background data-[state=open]:animate-in data-[state=closed]:animate-out fixed flex flex-col shadow-lg outline-none duration-200",
            SIDE_CLASS[side],
            zLayerClass("floating"),
            container && "absolute",
            className,
          )}
          style={style}
          onOpenAutoFocus={onOpenAutoFocus}
          onCloseAutoFocus={onCloseAutoFocus}
          // 浮く物より上の層(toast・cover)の中の押しは外押しにしない(Primitives の DialogContent と同じ判定、当議会 D189)
          onInteractOutside={(event) => {
            if (isAboveFloatingTarget(event.target)) event.preventDefault();
          }}
          aria-describedby={undefined}
          data-side={side}
          data-slot={slot}
        >
          {showHandle ? (
            <div
              className="flex shrink-0 cursor-grab touch-none justify-center py-3 active:cursor-grabbing"
              onPointerDown={onHandlePointerDown}
              onPointerMove={onHandlePointerMove}
              onPointerUp={onHandlePointerEnd}
              onPointerCancel={onHandlePointerEnd}
              data-slot="sheet-handle"
            >
              <div className="h-1.5 w-12 rounded-full bg-muted-foreground/30" />
            </div>
          ) : null}
          {resolvedTitleSrOnly ? (
            <DialogTitle srOnly>{resolvedTitle}</DialogTitle>
          ) : (
            <DialogTitle className={cn("shrink-0 px-4 pb-2", !showHandle && "pt-4")}>{resolvedTitle}</DialogTitle>
          )}
          <div className={cn("min-h-0 flex-1", scrollable && "overflow-y-auto")}>{children}</div>
          {showCloseButton ? (
            <DialogBareClose
              className="absolute top-3 right-3 cursor-pointer rounded-full p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
              data-slot="sheet-close"
            >
              <XIcon className="size-5" />
              <span className="sr-only">閉じる</span>
            </DialogBareClose>
          ) : null}
        </DialogBareContent>
      </DialogPortal>
    </DialogPrimitives>
  );
}

export default Sheet;
