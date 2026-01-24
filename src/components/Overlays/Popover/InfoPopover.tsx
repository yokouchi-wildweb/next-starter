// src/components/Overlays/Popover/InfoPopover.tsx

"use client";

import { type ReactNode, useState } from "react";
import { HelpCircle, Info } from "lucide-react";

import { cn } from "@/lib/cn";

import {
  PopoverRoot,
  PopoverTrigger,
  PopoverContent,
  PopoverHeader,
  PopoverTitle,
  PopoverBody,
  type PopoverContentProps,
} from "./PopoverPrimitives";

export type InfoPopoverProps = {
  /** タイトル */
  title?: ReactNode;
  /** 情報コンテンツ */
  children: ReactNode;
  /** トリガーアイコンの種類 */
  iconType?: "help" | "info";
  /** カスタムトリガー（指定時はiconTypeは無視） */
  trigger?: ReactNode;
  /** アイコンのサイズ */
  iconSize?: "sm" | "md" | "lg";
  /** アイコンの色 */
  iconClassName?: string;
  /** 制御モード: 開閉状態 */
  open?: boolean;
  /** 制御モード: 開閉状態変更コールバック */
  onOpenChange?: (open: boolean) => void;
} & Omit<PopoverContentProps, "children">;

const ICON_SIZE_CLASS = {
  sm: "size-3.5",
  md: "size-4",
  lg: "size-5",
};

/**
 * 情報・ヘルプ表示用ポップオーバー
 *
 * @example
 * // 基本使用（?アイコン）
 * <InfoPopover title="税込価格について">
 *   消費税10%を含んだ価格です。
 *   軽減税率対象商品は8%で計算されます。
 * </InfoPopover>
 *
 * @example
 * // infoアイコン
 * <InfoPopover iconType="info" title="ヒント">
 *   キーボードショートカット: Cmd + S で保存できます
 * </InfoPopover>
 *
 * @example
 * // カスタムトリガー
 * <InfoPopover trigger={<span className="underline">詳細</span>}>
 *   詳細な説明文...
 * </InfoPopover>
 */
export function InfoPopover({
  title,
  children,
  iconType = "help",
  trigger,
  iconSize = "md",
  iconClassName,
  open: controlledOpen,
  onOpenChange,
  // PopoverContent props
  size = "md",
  layer,
  showArrow = true,
  side = "top",
  sideOffset,
  align,
  alignOffset,
  className,
  ...contentProps
}: InfoPopoverProps) {
  const [internalOpen, setInternalOpen] = useState(false);

  // 制御/非制御の判定
  const isControlled = controlledOpen !== undefined;
  const open = isControlled ? controlledOpen : internalOpen;
  const setOpen = isControlled
    ? (onOpenChange ?? (() => {}))
    : (newOpen: boolean) => {
        setInternalOpen(newOpen);
        onOpenChange?.(newOpen);
      };

  const Icon = iconType === "info" ? Info : HelpCircle;

  const defaultTrigger = (
    <button
      type="button"
      className={cn(
        "inline-flex items-center justify-center rounded-full",
        "text-muted-foreground hover:text-foreground",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        "transition-colors",
        iconClassName
      )}
      aria-label={iconType === "info" ? "情報を表示" : "ヘルプを表示"}
    >
      <Icon className={ICON_SIZE_CLASS[iconSize]} />
    </button>
  );

  return (
    <PopoverRoot open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>{trigger ?? defaultTrigger}</PopoverTrigger>
      <PopoverContent
        size={size}
        layer={layer}
        showArrow={showArrow}
        side={side}
        sideOffset={sideOffset}
        align={align}
        alignOffset={alignOffset}
        className={className}
        {...contentProps}
      >
        {title && (
          <PopoverHeader>
            <PopoverTitle>{title}</PopoverTitle>
          </PopoverHeader>
        )}
        <PopoverBody className="text-muted-foreground">{children}</PopoverBody>
      </PopoverContent>
    </PopoverRoot>
  );
}

export default InfoPopover;
