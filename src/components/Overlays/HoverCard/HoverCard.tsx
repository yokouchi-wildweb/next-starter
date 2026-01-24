// src/components/Overlays/HoverCard/HoverCard.tsx

"use client";

import * as React from "react";
import * as HoverCardPrimitive from "@radix-ui/react-hover-card";

import { cn } from "@/lib/cn";

// レイヤータイプ
export type HoverCardLayer = "overlay" | "alert" | "super" | "ultimate" | "apex";

const LAYER_CLASS: Record<HoverCardLayer, string> = {
  overlay: "overlay-layer",
  alert: "alert-layer",
  super: "super-layer",
  ultimate: "ultimate-layer",
  apex: "apex-layer",
};

// サイズプリセット
export type HoverCardSize = "sm" | "md" | "lg" | "xl" | "auto";

const SIZE_CLASS: Record<HoverCardSize, string> = {
  sm: "w-56",
  md: "w-72",
  lg: "w-80",
  xl: "w-96",
  auto: "w-auto",
};

export type HoverCardProps = {
  /** ホバー対象の要素 */
  trigger: React.ReactNode;
  /** ホバーカードのコンテンツ */
  children: React.ReactNode;
  /** 表示位置 */
  side?: "top" | "right" | "bottom" | "left";
  /** 配置 */
  align?: "start" | "center" | "end";
  /** トリガーからのオフセット（px） */
  sideOffset?: number;
  /** 表示までの遅延（ms） */
  openDelay?: number;
  /** 非表示までの遅延（ms） */
  closeDelay?: number;
  /** サイズプリセット */
  size?: HoverCardSize;
  /** z-indexレイヤー */
  layer?: HoverCardLayer;
  /** 矢印を表示するか */
  showArrow?: boolean;
  /** triggerにasChildを適用するか */
  asChild?: boolean;
  /** コンテンツの追加クラス */
  className?: string;
  /** 開閉状態（制御モード） */
  open?: boolean;
  /** 開閉状態変更コールバック */
  onOpenChange?: (open: boolean) => void;
  /** デフォルトの開閉状態（非制御モード） */
  defaultOpen?: boolean;
};

/**
 * ホバープレビューコンポーネント
 * リンクやユーザー名にホバーで詳細をプレビュー表示
 *
 * @example
 * // 基本使用
 * <HoverCard
 *   trigger={<Link href="/users/1">@username</Link>}
 *   openDelay={300}
 * >
 *   <UserPreviewCard user={user} />
 * </HoverCard>
 *
 * @example
 * // リンクプレビュー
 * <HoverCard
 *   trigger={<a href={url}>{title}</a>}
 *   size="lg"
 * >
 *   <LinkPreview url={url} />
 * </HoverCard>
 */
export function HoverCard({
  trigger,
  children,
  side = "bottom",
  align = "center",
  sideOffset = 4,
  openDelay = 300,
  closeDelay = 200,
  size = "md",
  layer = "overlay",
  showArrow = false,
  asChild = true,
  className,
  open,
  onOpenChange,
  defaultOpen,
}: HoverCardProps) {
  return (
    <HoverCardPrimitive.Root
      open={open}
      onOpenChange={onOpenChange}
      defaultOpen={defaultOpen}
      openDelay={openDelay}
      closeDelay={closeDelay}
    >
      <HoverCardPrimitive.Trigger asChild={asChild}>
        {trigger}
      </HoverCardPrimitive.Trigger>
      <HoverCardPrimitive.Portal>
        <HoverCardPrimitive.Content
          side={side}
          align={align}
          sideOffset={sideOffset}
          className={cn(
            "bg-popover text-popover-foreground",
            "origin-(--radix-hover-card-content-transform-origin)",
            "rounded-md border p-4 shadow-md outline-hidden",
            // アニメーション
            "data-[state=open]:animate-in data-[state=closed]:animate-out",
            "data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
            "data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95",
            "data-[side=bottom]:slide-in-from-top-2",
            "data-[side=left]:slide-in-from-right-2",
            "data-[side=right]:slide-in-from-left-2",
            "data-[side=top]:slide-in-from-bottom-2",
            SIZE_CLASS[size],
            LAYER_CLASS[layer],
            className
          )}
        >
          {children}
          {showArrow && (
            <HoverCardPrimitive.Arrow className="fill-popover" />
          )}
        </HoverCardPrimitive.Content>
      </HoverCardPrimitive.Portal>
    </HoverCardPrimitive.Root>
  );
}

export default HoverCard;
