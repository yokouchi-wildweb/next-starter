// src/components/Overlays/Popover/PromptPopover.tsx

"use client";

import { type ReactNode, useState, useCallback, useRef, useEffect } from "react";

import { Button } from "@/components/Form/Button/Button";
import { type ButtonStyleProps } from "@/components/Form/Button/button-variants";
import { Input } from "@/components/Form/Input/Manual/Input";
import { Textarea } from "@/components/Form/Input/Manual/Textarea";

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

export type PromptPopoverProps = {
  /** ポップオーバーを開くトリガー要素 */
  trigger: ReactNode;
  /** タイトル */
  title?: ReactNode;
  /** 説明文 */
  description?: ReactNode;
  /** プレースホルダー */
  placeholder?: string;
  /** 入力の初期値 */
  defaultValue?: string;
  /** 確認ボタンのラベル */
  confirmLabel?: string;
  /** キャンセルボタンのラベル */
  cancelLabel?: string;
  /** 確認時のコールバック（Promiseを返すと自動でローディング状態になる） */
  onConfirm?: (value: string) => void | Promise<void>;
  /** キャンセル時のコールバック */
  onCancel?: () => void;
  /** 確認ボタンのスタイル */
  confirmVariant?: ButtonStyleProps["variant"];
  /** キャンセルボタンのスタイル */
  cancelVariant?: ButtonStyleProps["variant"];
  /** バリデーション関数（エラーメッセージを返すとエラー表示、nullで成功） */
  validation?: (value: string) => string | null;
  /** 入力タイプ */
  inputType?: "text" | "number" | "email" | "tel" | "url";
  /** 複数行入力（textarea）にするか */
  multiline?: boolean;
  /** textareaの行数（multiline時のみ有効） */
  rows?: number;
  /** 確認後に自動で閉じるか */
  closeOnConfirm?: boolean;
  /** 開いた時に入力欄をクリアするか */
  clearOnOpen?: boolean;
  /** triggerにasChildを適用するか */
  asChild?: boolean;
  /** 制御モード: 開閉状態 */
  open?: boolean;
  /** 制御モード: 開閉状態変更コールバック */
  onOpenChange?: (open: boolean) => void;
} & Omit<PopoverContentProps, "children">;

/**
 * 入力用ポップオーバーコンポーネント
 * 単一入力 + 確定ボタンのパターン
 *
 * @example
 * // 基本使用
 * <PromptPopover
 *   trigger={<Button>追跡番号</Button>}
 *   title="追跡番号を入力"
 *   description="配送業者から通知された追跡番号を入力してください"
 *   placeholder="例: 1234-5678-9012"
 *   onConfirm={async (value) => {
 *     await updateTrackingNumber(id, value);
 *   }}
 * />
 *
 * @example
 * // バリデーション付き
 * <PromptPopover
 *   trigger={<Button>メモ</Button>}
 *   title="メモを追加"
 *   multiline
 *   rows={4}
 *   validation={(v) => v.length > 0 ? null : "入力してください"}
 *   onConfirm={handleSave}
 * />
 */
export function PromptPopover({
  trigger,
  title,
  description,
  placeholder,
  defaultValue = "",
  confirmLabel = "確定",
  cancelLabel = "キャンセル",
  onConfirm,
  onCancel,
  confirmVariant = "primary",
  cancelVariant = "outline",
  validation,
  inputType = "text",
  multiline = false,
  rows = 3,
  closeOnConfirm = true,
  clearOnOpen = false,
  asChild = true,
  open: controlledOpen,
  onOpenChange,
  // PopoverContent props
  size = "md",
  layer,
  showArrow,
  side,
  sideOffset,
  align,
  alignOffset,
  className,
  ...contentProps
}: PromptPopoverProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const [value, setValue] = useState(defaultValue);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

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

  // 開いた時の処理
  useEffect(() => {
    if (open) {
      if (clearOnOpen) {
        setValue("");
      } else {
        setValue(defaultValue);
      }
      setError(null);
      // フォーカスを入力欄に移動
      setTimeout(() => {
        if (multiline) {
          textareaRef.current?.focus();
        } else {
          inputRef.current?.focus();
        }
      }, 0);
    }
  }, [open, clearOnOpen, defaultValue, multiline]);

  const handleConfirm = useCallback(async () => {
    // バリデーション
    if (validation) {
      const validationError = validation(value);
      if (validationError) {
        setError(validationError);
        return;
      }
    }

    setError(null);

    if (!onConfirm) {
      if (closeOnConfirm) setOpen(false);
      return;
    }

    const result = onConfirm(value);

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
  }, [onConfirm, value, validation, closeOnConfirm, setOpen]);

  const handleCancel = useCallback(() => {
    onCancel?.();
    setOpen(false);
  }, [onCancel, setOpen]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      // Enterで確定（multilineの場合はCmd/Ctrl+Enter）
      if (e.key === "Enter") {
        if (multiline) {
          if (e.metaKey || e.ctrlKey) {
            e.preventDefault();
            handleConfirm();
          }
        } else {
          e.preventDefault();
          handleConfirm();
        }
      }
      // Escapeでキャンセル
      if (e.key === "Escape") {
        e.preventDefault();
        handleCancel();
      }
    },
    [multiline, handleConfirm, handleCancel]
  );

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
        {(title || description) && (
          <PopoverHeader>
            {title && <PopoverTitle>{title}</PopoverTitle>}
            {description && <PopoverDescription>{description}</PopoverDescription>}
          </PopoverHeader>
        )}
        <PopoverBody>
          {multiline ? (
            <Textarea
              ref={textareaRef}
              value={value}
              onChange={(e) => {
                setValue(e.target.value);
                if (error) setError(null);
              }}
              onKeyDown={handleKeyDown}
              placeholder={placeholder}
              rows={rows}
              disabled={isLoading}
              className={error ? "border-destructive" : ""}
            />
          ) : (
            <Input
              ref={inputRef}
              type={inputType}
              value={value}
              onChange={(e) => {
                setValue(e.target.value);
                if (error) setError(null);
              }}
              onKeyDown={handleKeyDown}
              placeholder={placeholder}
              disabled={isLoading}
              className={error ? "border-destructive" : ""}
            />
          )}
          {error && (
            <p className="mt-1 text-xs text-destructive">{error}</p>
          )}
          {multiline && (
            <p className="mt-1 text-xs text-muted-foreground">
              Cmd/Ctrl + Enter で確定
            </p>
          )}
        </PopoverBody>
        <PopoverFooter>
          <Button
            size="sm"
            variant={cancelVariant}
            onClick={handleCancel}
            disabled={isLoading}
          >
            {cancelLabel}
          </Button>
          <Button
            size="sm"
            variant={confirmVariant}
            onClick={handleConfirm}
            disabled={isLoading}
          >
            {isLoading ? "処理中..." : confirmLabel}
          </Button>
        </PopoverFooter>
      </PopoverContent>
    </PopoverRoot>
  );
}

export default PromptPopover;
