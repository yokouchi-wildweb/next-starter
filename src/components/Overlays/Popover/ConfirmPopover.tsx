// src/components/Overlays/Popover/ConfirmPopover.tsx

"use client";

import { type ReactNode, useState, useCallback } from "react";

import { Button } from "@/components/Form/Button/Button";
import { type ButtonStyleProps } from "@/components/Form/Button/button-variants";

import {
  PopoverRoot,
  PopoverTrigger,
  PopoverContent,
  PopoverHeader,
  PopoverTitle,
  PopoverDescription,
  PopoverFooter,
  type PopoverContentProps,
} from "./PopoverPrimitives";

export type ConfirmPopoverProps = {
  /** ポップオーバーを開くトリガー要素 */
  trigger: ReactNode;
  /** タイトル */
  title?: ReactNode;
  /** 説明文 */
  description?: ReactNode;
  /** 確認ボタンのラベル（falseで非表示） */
  confirmLabel?: string | false;
  /** キャンセルボタンのラベル（falseで非表示） */
  cancelLabel?: string | false;
  /** 確認時のコールバック（Promiseを返すと自動でローディング状態になる） */
  onConfirm?: () => void | Promise<void>;
  /** キャンセル時のコールバック */
  onCancel?: () => void;
  /** 確認ボタンのスタイル */
  confirmVariant?: ButtonStyleProps["variant"];
  /** キャンセルボタンのスタイル */
  cancelVariant?: ButtonStyleProps["variant"];
  /** 確認ボタンを無効化 */
  confirmDisabled?: boolean;
  /** 確認後に自動で閉じるか */
  closeOnConfirm?: boolean;
  /** triggerにasChildを適用するか */
  asChild?: boolean;
  /** 制御モード: 開閉状態 */
  open?: boolean;
  /** 制御モード: 開閉状態変更コールバック */
  onOpenChange?: (open: boolean) => void;
} & Omit<PopoverContentProps, "children">;

/**
 * 確認用ポップオーバーコンポーネント
 * モーダルより軽量な確認UIを提供
 *
 * @example
 * // 削除確認
 * <ConfirmPopover
 *   trigger={<Button variant="destructive">削除</Button>}
 *   title="削除しますか？"
 *   description="この操作は取り消せません"
 *   onConfirm={handleDelete}
 *   confirmVariant="destructive"
 * />
 *
 * @example
 * // 非同期処理
 * <ConfirmPopover
 *   trigger={<Button>送信</Button>}
 *   title="送信しますか？"
 *   onConfirm={async () => {
 *     await submitData();
 *   }}
 * />
 */
export function ConfirmPopover({
  trigger,
  title = "確認",
  description,
  confirmLabel = "確認",
  cancelLabel = "キャンセル",
  onConfirm,
  onCancel,
  confirmVariant = "primary",
  cancelVariant = "outline",
  confirmDisabled = false,
  closeOnConfirm = true,
  asChild = true,
  open: controlledOpen,
  onOpenChange,
  // PopoverContent props
  size = "sm",
  layer,
  showArrow,
  side,
  sideOffset,
  align,
  alignOffset,
  className,
  ...contentProps
}: ConfirmPopoverProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // 制御/非制御の判定
  const isControlled = controlledOpen !== undefined;
  const open = isControlled ? controlledOpen : internalOpen;
  const setOpen = useCallback(
    (newOpen: boolean) => {
      if (isControlled) {
        onOpenChange?.(newOpen);
      } else {
        setInternalOpen(newOpen);
        onOpenChange?.(newOpen);
      }
    },
    [isControlled, onOpenChange]
  );

  const handleConfirm = useCallback(async () => {
    if (!onConfirm) {
      if (closeOnConfirm) setOpen(false);
      return;
    }

    const result = onConfirm();

    // Promiseの場合はローディング状態を管理
    if (result instanceof Promise) {
      setIsLoading(true);
      try {
        await result;
        if (closeOnConfirm) setOpen(false);
      } finally {
        setIsLoading(false);
      }
    } else {
      if (closeOnConfirm) setOpen(false);
    }
  }, [onConfirm, closeOnConfirm, setOpen]);

  const handleCancel = useCallback(() => {
    onCancel?.();
    setOpen(false);
  }, [onCancel, setOpen]);

  return (
    <PopoverRoot open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild={asChild}>{trigger}</PopoverTrigger>
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
        <PopoverHeader>
          <PopoverTitle>{title}</PopoverTitle>
          {description && <PopoverDescription>{description}</PopoverDescription>}
        </PopoverHeader>
        <PopoverFooter>
          {cancelLabel !== false && (
            <Button
              size="sm"
              variant={cancelVariant}
              onClick={handleCancel}
              disabled={isLoading}
            >
              {cancelLabel}
            </Button>
          )}
          {confirmLabel !== false && (
            <Button
              size="sm"
              variant={confirmVariant}
              onClick={handleConfirm}
              disabled={confirmDisabled || isLoading}
            >
              {isLoading ? "処理中..." : confirmLabel}
            </Button>
          )}
        </PopoverFooter>
      </PopoverContent>
    </PopoverRoot>
  );
}

export default ConfirmPopover;
