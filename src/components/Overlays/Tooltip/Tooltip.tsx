// src/components/Overlays/Tooltip/Tooltip.tsx

"use client";

import * as React from "react";
import * as TooltipPrimitive from "@radix-ui/react-tooltip";

import { cn } from "@/lib/cn";

import { useIsInsideTooltipProvider } from "./Provider";

// レイヤータイプ
export type TooltipLayer = "overlay" | "alert" | "super" | "ultimate" | "apex";

const LAYER_CLASS: Record<TooltipLayer, string> = {
  overlay: "overlay-layer",
  alert: "alert-layer",
  super: "super-layer",
  ultimate: "ultimate-layer",
  apex: "apex-layer",
};

export type TooltipProps = {
  /** ツールチップの内容 */
  content: React.ReactNode;
  /** トリガー要素 */
  children: React.ReactNode;
  /** 表示位置 */
  side?: "top" | "right" | "bottom" | "left";
  /** 配置 */
  align?: "start" | "center" | "end";
  /** トリガーからのオフセット（px） */
  sideOffset?: number;
  /** 表示までの遅延（ms） */
  delayDuration?: number;
  /**
   * 直前のツールチップが閉じてからこの時間内は遅延なしで次を表示（ms）
   *
   * 明示指定すると共有 TooltipProvider 配下でも個別 Provider を mount して
   * この値を適用する（Radix仕様上 Provider 単位でしか効かないため）。
   * 未指定なら共有 Provider の設定に従う。
   */
  skipDelayDuration?: number;
  /** z-indexレイヤー */
  layer?: TooltipLayer;
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
 * シンプルなツールチップコンポーネント
 *
 * @example
 * // 基本使用
 * <Tooltip content="設定を開く">
 *   <IconButton icon={Settings} />
 * </Tooltip>
 *
 * @example
 * // カスタマイズ
 * <Tooltip
 *   content="この操作は取り消せません"
 *   side="right"
 *   delayDuration={500}
 * >
 *   <Button variant="destructive">削除</Button>
 * </Tooltip>
 */
export function Tooltip({
  content,
  children,
  side = "top",
  align = "center",
  sideOffset = 4,
  delayDuration = 200,
  skipDelayDuration,
  layer = "overlay",
  showArrow = true,
  asChild = true,
  className,
  open,
  onOpenChange,
  defaultOpen,
}: TooltipProps) {
  const isInsideProvider = useIsInsideTooltipProvider();
  // skipDelayDuration の明示指定は Provider 単位でしか適用できないため、
  // 指定時は共有 Provider 配下でも個別 Provider を mount する（後方互換）
  const useLocalProvider = !isInsideProvider || skipDelayDuration !== undefined;

  const root = (
      <TooltipPrimitive.Root
        open={open}
        onOpenChange={onOpenChange}
        defaultOpen={defaultOpen}
        delayDuration={useLocalProvider ? undefined : delayDuration}
      >
        <TooltipPrimitive.Trigger asChild={asChild}>
          {children}
        </TooltipPrimitive.Trigger>
        <TooltipPrimitive.Portal>
          <TooltipPrimitive.Content
            side={side}
            align={align}
            sideOffset={sideOffset}
            className={cn(
              "bg-foreground text-background",
              "origin-(--radix-tooltip-content-transform-origin)",
              "rounded-md px-3 py-1.5 text-xs text-balance",
              // アニメーション
              "animate-in fade-in-0 zoom-in-95",
              "data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95",
              "data-[side=bottom]:slide-in-from-top-2",
              "data-[side=left]:slide-in-from-right-2",
              "data-[side=right]:slide-in-from-left-2",
              "data-[side=top]:slide-in-from-bottom-2",
              LAYER_CLASS[layer],
              className
            )}
          >
            {content}
            {showArrow && (
              <TooltipPrimitive.Arrow
                className="fill-foreground size-2.5 translate-y-[calc(-50%_-_2px)] rotate-45 rounded-[2px]"
              />
            )}
          </TooltipPrimitive.Content>
        </TooltipPrimitive.Portal>
      </TooltipPrimitive.Root>
  );

  if (!useLocalProvider) return root;

  return (
    <TooltipPrimitive.Provider
      delayDuration={delayDuration}
      skipDelayDuration={skipDelayDuration ?? 300}
    >
      {root}
    </TooltipPrimitive.Provider>
  );
}

export default Tooltip;
