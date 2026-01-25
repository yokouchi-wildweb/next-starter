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
  /** ポータルを使用するか（デフォルト: true） */
  usePortal?: boolean;
};

function PopoverContent({
  className,
  align = "center",
  sideOffset = 4,
  size = "md",
  layer = "overlay",
  showArrow = false,
  showClose = false,
  usePortal = true,
  children,
  ...props
}: PopoverContentProps) {
  const content = (
    <PopoverPrimitive.Content
      data-slot="popover-content"
      align={align}
      sideOffset={sideOffset}
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

  if (usePortal) {
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
