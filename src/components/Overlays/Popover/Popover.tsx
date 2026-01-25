// src/components/Overlays/Popover/Popover.tsx

"use client";

import { type ReactNode, useState } from "react";

import {
  PopoverRoot,
  PopoverTrigger,
  PopoverContent,
  PopoverHeader,
  PopoverTitle,
  PopoverDescription,
  PopoverBody,
  PopoverFooter,
  type PopoverContentProps,
} from "./PopoverPrimitives";

export type PopoverProps = {
  /** ポップオーバーを開くトリガー要素 */
  trigger: ReactNode;
  /** タイトル */
  title?: ReactNode;
  /** 説明文 */
  description?: ReactNode;
  /** 本文コンテンツ */
  children?: ReactNode;
  /** フッター（ボタンなど） */
  footer?: ReactNode;
  /** 制御モード: 開閉状態 */
  open?: boolean;
  /** 制御モード: 開閉状態変更コールバック */
  onOpenChange?: (open: boolean) => void;
  /** 非制御モード: デフォルトの開閉状態 */
  defaultOpen?: boolean;
  /** triggerにasChildを適用するか */
  asChild?: boolean;
} & Omit<PopoverContentProps, "children">;

/**
 * 汎用ポップオーバーコンポーネント
 *
 * @example
 * // 基本使用
 * <Popover
 *   trigger={<Button>開く</Button>}
 *   title="設定"
 *   description="表示設定を変更します"
 * >
 *   <p>コンテンツ...</p>
 * </Popover>
 *
 * @example
 * // 制御モード
 * const [open, setOpen] = useState(false);
 * <Popover
 *   open={open}
 *   onOpenChange={setOpen}
 *   trigger={<Button>開く</Button>}
 * >
 *   <p>コンテンツ...</p>
 * </Popover>
 */
export function Popover({
  trigger,
  title,
  description,
  children,
  footer,
  open: controlledOpen,
  onOpenChange,
  defaultOpen = false,
  asChild = true,
  // PopoverContent props
  size,
  layer,
  showArrow,
  showClose,
  usePortal,
  side,
  sideOffset,
  align,
  alignOffset,
  className,
  ...contentProps
}: PopoverProps) {
  // 非制御モードの場合の内部状態
  const [internalOpen, setInternalOpen] = useState(defaultOpen);

  // 制御/非制御の判定
  const isControlled = controlledOpen !== undefined;
  const open = isControlled ? controlledOpen : internalOpen;
  const setOpen = isControlled
    ? (onOpenChange ?? (() => {}))
    : (newOpen: boolean) => {
        setInternalOpen(newOpen);
        onOpenChange?.(newOpen);
      };

  const hasHeader = title || description;

  return (
    <PopoverRoot open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild={asChild}>{trigger}</PopoverTrigger>
      <PopoverContent
        size={size}
        layer={layer}
        showArrow={showArrow}
        showClose={showClose}
        usePortal={usePortal}
        side={side}
        sideOffset={sideOffset}
        align={align}
        alignOffset={alignOffset}
        className={className}
        {...contentProps}
      >
        {hasHeader && (
          <PopoverHeader>
            {title && <PopoverTitle>{title}</PopoverTitle>}
            {description && <PopoverDescription>{description}</PopoverDescription>}
          </PopoverHeader>
        )}
        {children && (
          <PopoverBody className="max-h-[330px] overflow-y-auto">
            {children}
          </PopoverBody>
        )}
        {footer && <PopoverFooter>{footer}</PopoverFooter>}
      </PopoverContent>
    </PopoverRoot>
  );
}

export default Popover;
