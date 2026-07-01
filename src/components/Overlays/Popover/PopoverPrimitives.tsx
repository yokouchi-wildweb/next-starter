// src/components/Overlays/Popover/PopoverPrimitives.tsx

"use client";

import * as React from "react";
import * as PopoverPrimitive from "@radix-ui/react-popover";
import { X } from "lucide-react";

import { cn } from "@/lib/cn";

// レイヤータイプ
export type PopoverLayer = "overlay" | "alert" | "super" | "ultimate" | "apex";

const LAYER_CLASS: Record<PopoverLayer, string> = {
  overlay: "overlay-layer",
  alert: "alert-layer",
  super: "super-layer",
  ultimate: "ultimate-layer",
  apex: "apex-layer",
};

// サイズプリセット
export type PopoverSize = "sm" | "md" | "lg" | "xl" | "auto";

const SIZE_CLASS: Record<PopoverSize, string> = {
  sm: "w-56",
  md: "w-72",
  lg: "w-80",
  xl: "w-96",
  auto: "w-auto",
};

// 複数の ref を1つに束ねる（内部用）
function mergeRefs<T>(
  ...refs: (React.Ref<T> | undefined)[]
): React.RefCallback<T> {
  return (node: T) => {
    for (const ref of refs) {
      if (!ref) continue;
      if (typeof ref === "function") ref(node);
      else (ref as React.MutableRefObject<T | null>).current = node;
    }
  };
}

// Popover 内部コンテキスト（トリガーの DOM 位置を Content から参照するため）
type PopoverContextValue = {
  /** トリガー要素の ref（ダイアログ入れ子検出に使う） */
  triggerRef: React.MutableRefObject<HTMLElement | null>;
};

const PopoverContext = React.createContext<PopoverContextValue | null>(null);

// Popover Root
function PopoverRoot({
  ...props
}: React.ComponentProps<typeof PopoverPrimitive.Root>) {
  const triggerRef = React.useRef<HTMLElement | null>(null);
  return (
    <PopoverContext.Provider value={{ triggerRef }}>
      <PopoverPrimitive.Root data-slot="popover" {...props} />
    </PopoverContext.Provider>
  );
}

// Popover Trigger
function PopoverTrigger({
  className,
  ref,
  ...props
}: React.ComponentProps<typeof PopoverPrimitive.Trigger>) {
  const ctx = React.useContext(PopoverContext);
  return (
    <PopoverPrimitive.Trigger
      ref={mergeRefs(ctx?.triggerRef, ref)}
      data-slot="popover-trigger"
      className={cn("cursor-pointer", className)}
      {...props}
    />
  );
}

// Popover Anchor
function PopoverAnchor({
  ...props
}: React.ComponentProps<typeof PopoverPrimitive.Anchor>) {
  return <PopoverPrimitive.Anchor data-slot="popover-anchor" {...props} />;
}

// Popover Arrow
function PopoverArrow({
  className,
  ...props
}: React.ComponentProps<typeof PopoverPrimitive.Arrow>) {
  return (
    <PopoverPrimitive.Arrow
      data-slot="popover-arrow"
      className={cn("fill-popover", className)}
      width={12}
      height={6}
      {...props}
    />
  );
}

// Popover Close
function PopoverClose({
  className,
  ...props
}: React.ComponentProps<typeof PopoverPrimitive.Close>) {
  return (
    <PopoverPrimitive.Close
      data-slot="popover-close"
      className={cn(
        "absolute right-2 top-2 rounded-sm opacity-70 ring-offset-background transition-opacity",
        "hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
        "disabled:pointer-events-none data-[state=open]:bg-accent data-[state=open]:text-muted-foreground",
        className
      )}
      {...props}
    >
      <X className="size-4" />
      <span className="sr-only">閉じる</span>
    </PopoverPrimitive.Close>
  );
}

// Popover Content
export type PopoverContentProps = React.ComponentProps<
  typeof PopoverPrimitive.Content
> & {
  /** サイズプリセット */
  size?: PopoverSize;
  /** z-indexレイヤー */
  layer?: PopoverLayer;
  /** 矢印を表示するか */
  showArrow?: boolean;
  /** 閉じるボタンを表示するか */
  showClose?: boolean;
  /**
   * ポータルを使用するか。
   * 未指定時は自動判定: ダイアログ/モーダル内に入れ子のときは非ポータル（false）、
   * それ以外は従来通りポータル（true）。
   * 理由: Radix Dialog の react-remove-scroll は body 直下ポータル（ダイアログ外）の
   * wheel/touch を食うため、入れ子時は非ポータルにしてスクロールを通す。
   */
  usePortal?: boolean;
  /**
   * ダイアログ自身の dismiss 操作（オーバーレイ/閉じるボタン）でポップオーバーが
   * 閉じないようにするか（デフォルト: true）。
   * 注: 空のモーダル本体など、ダイアログの dismiss chrome 以外の外側クリックは
   * （standard なポップオーバーUXとして）常にポップオーバーを閉じる。
   */
  preventLayerDismiss?: boolean;
  /** ポインターイベントの親要素への伝播を止めるか（デフォルト: true） */
  stopPropagation?: boolean;
};

function PopoverContent({
  className,
  align = "center",
  sideOffset = 4,
  size = "md",
  layer = "overlay",
  showArrow = false,
  showClose = false,
  usePortal,
  preventLayerDismiss = true,
  stopPropagation = true,
  onInteractOutside,
  onPointerDown,
  onMouseDown,
  onClick,
  onDoubleClick,
  onContextMenu,
  children,
  ...props
}: PopoverContentProps) {
  // 上位レイヤー（ダイアログ/モーダル等）との操作を検出して閉じないようにする
  type InteractOutsideEvent = Parameters<
    NonNullable<React.ComponentProps<typeof PopoverPrimitive.Content>["onInteractOutside"]>
  >[0];

  const handleInteractOutside = React.useCallback(
    (event: InteractOutsideEvent) => {
      if (preventLayerDismiss) {
        const target = event.target as HTMLElement | null;
        // ダイアログ「自身の dismiss chrome」（オーバーレイ/閉じるボタン）だけは
        // ポップオーバーの外クリック閉じを抑止する。
        // 以前は [data-slot="dialog-content"] / [role="dialog"] まで一致させていたため、
        // モーダル本体まるごとが該当し、モーダル内のどこをクリックしても閉じなかった。
        // 空のモーダル本体クリック等は下の onInteractOutside に流し、正しく閉じる。
        if (
          target?.closest('[data-slot="dialog-overlay"]') ||
          target?.closest('[data-slot="dialog-close"]')
        ) {
          event.preventDefault();
          return;
        }
      }
      onInteractOutside?.(event);
    },
    [preventLayerDismiss, onInteractOutside]
  );

  // ポインターイベントの親要素への伝播を止める
  const handlePointerDown = React.useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (stopPropagation) {
        event.stopPropagation();
      }
      onPointerDown?.(event);
    },
    [stopPropagation, onPointerDown]
  );

  // マウスダウンイベントの親要素への伝播を止める（PointerEvents非対応コード向け）
  const handleMouseDown = React.useCallback(
    (event: React.MouseEvent<HTMLDivElement>) => {
      if (stopPropagation) {
        event.stopPropagation();
      }
      onMouseDown?.(event);
    },
    [stopPropagation, onMouseDown]
  );

  // クリックイベントの親要素への伝播を止める
  const handleClick = React.useCallback(
    (event: React.MouseEvent<HTMLDivElement>) => {
      if (stopPropagation) {
        event.stopPropagation();
      }
      onClick?.(event);
    },
    [stopPropagation, onClick]
  );

  // ダブルクリックイベントの親要素への伝播を止める
  const handleDoubleClick = React.useCallback(
    (event: React.MouseEvent<HTMLDivElement>) => {
      if (stopPropagation) {
        event.stopPropagation();
      }
      onDoubleClick?.(event);
    },
    [stopPropagation, onDoubleClick]
  );

  // コンテキストメニュー（右クリック）イベントの親要素への伝播を止める
  const handleContextMenu = React.useCallback(
    (event: React.MouseEvent<HTMLDivElement>) => {
      if (stopPropagation) {
        event.stopPropagation();
      }
      onContextMenu?.(event);
    },
    [stopPropagation, onContextMenu]
  );

  // ダイアログ/モーダル内に入れ子かどうかをトリガーの DOM 位置から判定
  const ctx = React.useContext(PopoverContext);
  const nestedInDialog =
    typeof document !== "undefined" &&
    Boolean(ctx?.triggerRef.current?.closest('[data-slot="dialog-content"]'));
  // 明示指定があれば尊重、無ければ入れ子時のみ非ポータル（RemoveScroll対策）
  const effectivePortal = usePortal ?? !nestedInDialog;

  const content = (
    <PopoverPrimitive.Content
      data-slot="popover-content"
      align={align}
      sideOffset={sideOffset}
      onInteractOutside={handleInteractOutside}
      onPointerDown={handlePointerDown}
      onMouseDown={handleMouseDown}
      onClick={handleClick}
      onDoubleClick={handleDoubleClick}
      onContextMenu={handleContextMenu}
      className={cn(
        "bg-popover text-popover-foreground",
        "origin-(--radix-popover-content-transform-origin)",
        "rounded-md border p-4 shadow-md outline-hidden",
        // アニメーション
        "data-[state=open]:animate-in data-[state=closed]:animate-out",
        "data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
        "data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95",
        "data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2",
        "data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2",
        // サイズとレイヤー
        SIZE_CLASS[size],
        LAYER_CLASS[layer],
        className
      )}
      {...props}
    >
      {showClose && <PopoverClose />}
      {children}
      {showArrow && <PopoverArrow />}
    </PopoverPrimitive.Content>
  );

  if (effectivePortal) {
    return <PopoverPrimitive.Portal>{content}</PopoverPrimitive.Portal>;
  }

  return content;
}

// Popover Header
function PopoverHeader({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      data-slot="popover-header"
      className={cn("mb-3 flex flex-col gap-1", className)}
      {...props}
    />
  );
}

// Popover Title
function PopoverTitle({
  className,
  ...props
}: React.HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h3
      data-slot="popover-title"
      className={cn("font-semibold leading-none tracking-tight", className)}
      {...props}
    />
  );
}

// Popover Description
function PopoverDescription({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      data-slot="popover-description"
      className={cn("text-sm text-muted-foreground", className)}
      {...props}
    />
  );
}

// Popover Body
function PopoverBody({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div data-slot="popover-body" className={cn("text-sm", className)} {...props} />
  );
}

// Popover Footer
function PopoverFooter({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      data-slot="popover-footer"
      className={cn("mt-4 flex justify-end gap-2", className)}
      {...props}
    />
  );
}

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
};
