// src/components/Overlays/Dialog.tsx

"use client";

import { ReactNode, useState, useCallback, useRef } from "react";
import {
  DialogPrimitives,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  FALLBACK_DIALOG_TITLE,
  type DialogContentLayer,
  type DialogOverlayLayer,
} from "@/components/Overlays/DialogPrimitives";
import { Button } from "@/components/Form/Button/Button";
import { type ButtonStyleProps } from "@/components/Form/Button/button-variants";
import { cn } from "@/lib/cn";

export type TextVariant = "default" | "primary" | "secondary" | "accent" | "sr-only";
export type TextAlign = "left" | "center" | "right";

const TEXT_VARIANT_CLASS: Record<TextVariant, string> = {
  default: "text-foreground",
  primary: "text-primary",
  secondary: "text-secondary",
  accent: "text-accent",
  "sr-only": "sr-only",
};

const TEXT_ALIGN_CLASS: Record<TextAlign, string> = {
  left: "text-left",
  center: "text-center",
  right: "text-right",
};

export type DialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: ReactNode;
  titleVariant?: TextVariant;
  titleAlign?: TextAlign;
  /**
   * 説明文。DialogDescription（<p>タグ）でラップされ、aria-describedby の対象になる。
   * children と併用可（ヘッダ内で title の直下に描画され、children はその下の本体に入る）。
   */
  description?: ReactNode;
  descriptionVariant?: TextVariant;
  descriptionAlign?: TextAlign;
  /**
   * 複雑なコンテンツ用。そのまま本体（スクロール領域）に出力されるため、ブロック要素も使用可能。
   */
  children?: ReactNode;
  /**
   * 右上の ✕ ボタンを表示するか。
   * @default false（確認ダイアログはフッターのボタンで閉じるのが基本）
   * showCancelButton / showConfirmButton を両方 false にする場合は true にして、
   * 目に見える閉じ手段を必ず残すこと。
   */
  showCloseButton?: boolean;
  /**
   * ダイアログのz-indexレイヤー。
   * モーダルの上に表示する確認ダイアログなどは "alert" を指定する。
   * @default "modal"
   */
  layer?: DialogContentLayer;
  /**
   * オーバーレイ（背景）のz-indexレイヤー。
   * @default "modal"
   */
  overlayLayer?: DialogOverlayLayer;
  footerAlign?: TextAlign;
  showCancelButton?: boolean;
  showConfirmButton?: boolean;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm?: () => void | Promise<void>;
  confirmDisabled?: boolean;
  confirmVariant?: ButtonStyleProps["variant"];
  cancelVariant?: ButtonStyleProps["variant"];
  onCloseAutoFocus?: (event: Event) => void;
};

export function Dialog({
  open,
  onOpenChange,
  title,
  titleVariant = "default",
  titleAlign = "left",
  description,
  descriptionVariant = "default",
  descriptionAlign = "left",
  children,
  showCloseButton = false,
  layer,
  overlayLayer,
  footerAlign = "right",
  showCancelButton = true,
  showConfirmButton = true,
  confirmLabel = "OK",
  cancelLabel = "Cancel",
  onConfirm,
  confirmDisabled,
  confirmVariant = "primary",
  cancelVariant = "outline",
  onCloseAutoFocus,
}: DialogProps) {
  const [isLoading, setIsLoading] = useState(false);
  const lockRef = useRef(false);

  const handleConfirm = useCallback(async () => {
    if (!onConfirm || lockRef.current) return;

    const result = onConfirm();

    // Promiseの場合はローディング状態を管理
    if (result instanceof Promise) {
      lockRef.current = true;
      setIsLoading(true);
      try {
        await result;
      } finally {
        lockRef.current = false;
        setIsLoading(false);
      }
    }
  }, [onConfirm]);

  const footerAlignClass =
    footerAlign === "left"
      ? "justify-start sm:justify-start"
      : footerAlign === "center"
        ? "justify-center sm:justify-center"
        : "justify-end sm:justify-end";

  const showFooter = showCancelButton || showConfirmButton;

  return (
    <DialogPrimitives open={open} onOpenChange={onOpenChange}>
      {/* 箱の高さは Modal と同じ「ビューポート - 上下 1rem」で上限。flex-col + 本体 min-h-0 により
          長い description / children は本体だけがスクロールし、タイトルとボタン列は常に箱内に残る。
          fixed + translate 中央配置なので、上限が無いと上下両方にはみ出してスクロールで到達できない。 */}
      <DialogContent
        showCloseButton={showCloseButton}
        className="flex flex-col max-h-[calc(100dvh-2rem)]"
        layer={layer}
        overlayLayer={overlayLayer}
        onCloseAutoFocus={onCloseAutoFocus}
        // description 未指定を明示しないと Radix が警告を出す（指定時は Radix が自動で紐付ける）
        {...(description ? {} : { "aria-describedby": undefined })}
      >
        {title || description ? (
          <DialogHeader className="shrink-0">
            <DialogTitle
              srOnly={!title}
              className={cn(
                TEXT_VARIANT_CLASS[titleVariant],
                TEXT_ALIGN_CLASS[titleAlign],
              )}
            >
              {title || FALLBACK_DIALOG_TITLE}
            </DialogTitle>
            {description && (
              <DialogDescription
                className={cn(
                  TEXT_VARIANT_CLASS[descriptionVariant],
                  TEXT_ALIGN_CLASS[descriptionAlign],
                )}
              >
                {description}
              </DialogDescription>
            )}
          </DialogHeader>
        ) : (
          // title 省略時も role="dialog" にアクセシブルネームを必ず与える
          <DialogTitle srOnly>{FALLBACK_DIALOG_TITLE}</DialogTitle>
        )}
        {children != null && (
          <div className="min-h-0 overflow-y-auto">{children}</div>
        )}
        {showFooter && (
          <DialogFooter className={cn("mt-4 shrink-0", footerAlignClass)}>
            {showCancelButton && (
              <Button
                size="sm"
                variant={cancelVariant}
                onClick={(e) => {
                  e.stopPropagation();
                  onOpenChange(false);
                }}
                disabled={isLoading}
              >
                {cancelLabel}
              </Button>
            )}
            {showConfirmButton && (
              <Button
                size="sm"
                variant={confirmVariant}
                onClick={(e) => {
                  e.stopPropagation();
                  handleConfirm();
                }}
                disabled={confirmDisabled || isLoading}
              >
                {isLoading ? "処理中..." : confirmLabel}
              </Button>
            )}
          </DialogFooter>
        )}
      </DialogContent>
    </DialogPrimitives>
  );
}

export default Dialog;
