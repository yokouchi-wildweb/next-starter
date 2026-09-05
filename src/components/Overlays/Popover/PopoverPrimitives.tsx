// src/components/Overlays/Popover/PopoverPrimitives.tsx

"use client";

import * as React from "react";
import * as PopoverPrimitive from "@radix-ui/react-popover";
import { X } from "lucide-react";

import { cn } from "@/lib/cn";
import { useIsNestedInDialog } from "@/components/Overlays/DialogPrimitives";

// レイヤータイプ
export type PopoverLayer =
  | "overlay"
  | "surface-ui"
  | "alert"
  | "super"
  | "ultimate"
  | "apex";

const LAYER_CLASS: Record<PopoverLayer, string> = {
  overlay: "overlay-layer",
  "surface-ui": "surface-ui-layer",
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

// Popover Root
function PopoverRoot({
  ...props
}: React.ComponentProps<typeof PopoverPrimitive.Root>) {
  return <PopoverPrimitive.Root data-slot="popover" {...props} />;
}

// Popover Trigger
function PopoverTrigger({
  className,
  ...props
}: React.ComponentProps<typeof PopoverPrimitive.Trigger>) {
  return (
    <PopoverPrimitive.Trigger
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

  // ダイアログ/モーダル内に入れ子かどうかを React ツリー（DialogContent の context）で判定。
  // 旧実装はトリガーの DOM 位置を render 中に ref で読んでいたため、初回 render（defaultOpen 等）
  // では null → ポータル側に振られ、後続 render で付け替わって中身が remount していた
  const nestedInDialog = useIsNestedInDialog();
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
        // 高さ上限: Radix が算出する「配置側のビューポート残り高さ」を超えないようにし、
        // 内側ラッパーだけをスクロールさせる（Content 自体に overflow を付けると外側に
        // 張り出す矢印が切れるため、flex-col + min-h-0 の内側ラッパーで縮める）。
        // 上限が無いと長いリスト + フッターのポップオーバーで確定ボタンが画面外に出て
        // 到達不能になる
        "flex flex-col max-h-(--radix-popover-content-available-height)",
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
      <div data-slot="popover-scroll" className="min-h-0 overflow-y-auto">
        {children}
      </div>
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
