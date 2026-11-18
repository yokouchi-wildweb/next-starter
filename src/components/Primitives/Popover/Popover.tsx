// src/components/Primitives/Popover/Popover.tsx

"use client";

import * as React from "react";
import { Popover as PopoverPrimitive } from "radix-ui";
import { X } from "lucide-react";

import { cn } from "@/lib/cn";
import { isDialogFocusRestoration } from "./isDialogFocusRestoration";
import { isToastTarget } from "@/lib/toast";
import { zLayerClass } from "@/lib/zLayer";

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
  return <PopoverPrimitive.Root {...props} data-slot="popover" />;
}

// Popover Trigger
function PopoverTrigger({
  className,
  ...props
}: React.ComponentProps<typeof PopoverPrimitive.Trigger>) {
  return (
    <PopoverPrimitive.Trigger
      className={cn("cursor-pointer", className)}
      {...props}
      data-slot="popover-trigger"
    />
  );
}

// Popover Anchor
function PopoverAnchor({
  ...props
}: React.ComponentProps<typeof PopoverPrimitive.Anchor>) {
  return <PopoverPrimitive.Anchor {...props} data-slot="popover-anchor" />;
}

// Popover Arrow
function PopoverArrow({
  className,
  ...props
}: React.ComponentProps<typeof PopoverPrimitive.Arrow>) {
  return (
    <PopoverPrimitive.Arrow
      className={cn("fill-popover", className)}
      width={12}
      height={6}
      {...props}
      data-slot="popover-arrow"
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
      className={cn(
        "absolute right-2 top-2 rounded-sm opacity-70 ring-offset-background transition-opacity",
        "hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
        "disabled:pointer-events-none data-[state=open]:bg-accent data-[state=open]:text-muted-foreground",
        className
      )}
      {...props}
      data-slot="popover-close"
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
  /** 矢印を表示するか */
  showArrow?: boolean;
  /** 閉じるボタンを表示するか */
  showClose?: boolean;
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
  // 画面端に密着・はみ出さないよう、端から 8px 内側に収める(Radix の既定は 0)
  collisionPadding = 8,
  size = "md",
  showArrow = false,
  showClose = false,
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
      // トーストの中の押しは外押しにしない(トーストは浮く物より上の toast の層。押して消すとき開いている物を閉じない、当議会 D189)
      if (isToastTarget(event.target)) {
        event.preventDefault();
        return;
      }
      // Dialog の FocusScope がコンテナ自身へプログラム的に focus を戻した focusin は dismiss にしない。
      // Popover 内のボタンが「クリック → disabled + 中身差し替え」で activeElement を body に落とすと
      // FocusScope の MutationObserver が DialogContent へ focus し、Popover の React ツリー外なので
      // FOCUS_OUTSIDE として処理中の Popover が閉じていた。ユーザー意図のフォーカスではないため
      // preventLayerDismiss とは無関係に常時抑止する（詳細: isDialogFocusRestoration.ts）。
      if (
        isDialogFocusRestoration({
          originalEventType: event.detail.originalEvent.type,
          target: event.target,
        })
      ) {
        event.preventDefault();
        return;
      }
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

  const content = (
    <PopoverPrimitive.Content
      align={align}
      sideOffset={sideOffset}
      collisionPadding={collisionPadding}
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
        // サイズと層(浮く物はいつも floating、body へ portal。当議会 D189・D190)
        SIZE_CLASS[size],
        zLayerClass("floating"),
        className
      )}
      {...props}
      data-slot="popover-content"
    >
      {showClose && <PopoverClose />}
      <div data-slot="popover-scroll" className="min-h-0 overflow-y-auto">
        {children}
      </div>
      {showArrow && <PopoverArrow />}
    </PopoverPrimitive.Content>
  );

  return <PopoverPrimitive.Portal>{content}</PopoverPrimitive.Portal>;
}

// Popover Header
function PopoverHeader({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("mb-3 flex flex-col gap-1", className)}
      {...props}
      data-slot="popover-header"
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
      className={cn("font-semibold leading-none tracking-tight", className)}
      {...props}
      data-slot="popover-title"
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
      className={cn("text-sm text-muted-foreground", className)}
      {...props}
      data-slot="popover-description"
    />
  );
}

// Popover Body
function PopoverBody({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("text-sm", className)} {...props} data-slot="popover-body" />
  );
}

// Popover Footer
function PopoverFooter({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("mt-4 flex justify-end gap-2", className)}
      {...props}
      data-slot="popover-footer"
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
