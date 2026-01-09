// src/components/Overlays/Dialog.tsx

"use client";

import { ReactNode } from "react";
import {
  DialogPrimitives,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription,
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
   * シンプルなテキスト用。DialogDescription（<p>タグ）でラップされる。
   * children と排他的。children が指定された場合は無視される。
   */
  description?: ReactNode;
  descriptionVariant?: TextVariant;
  descriptionAlign?: TextAlign;
  /**
   * 複雑なコンテンツ用。そのまま出力されるため、ブロック要素も使用可能。
   * description と排他的。指定された場合は description より優先される。
   */
  children?: ReactNode;
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
  const footerAlignClass =
    footerAlign === "left"
      ? "justify-start sm:justify-start"
      : footerAlign === "center"
        ? "justify-center sm:justify-center"
        : "justify-end sm:justify-end";

  const showFooter = showCancelButton || showConfirmButton;

  return (
    <DialogPrimitives open={open} onOpenChange={onOpenChange}>
      <DialogContent showCloseButton={false} layer={layer} overlayLayer={overlayLayer} onCloseAutoFocus={onCloseAutoFocus}>
        {(title || (!children && description)) && (
          <DialogHeader>
            {title && (
              <DialogTitle
                className={cn(
                  TEXT_VARIANT_CLASS[titleVariant],
                  TEXT_ALIGN_CLASS[titleAlign],
                )}
              >
                {title}
              </DialogTitle>
            )}
            {!children && description && (
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
        )}
        {children}
        {showFooter && (
          <DialogFooter className={cn("mt-4", footerAlignClass)}>
            {showCancelButton && (
              <Button
                size="sm"
                variant={cancelVariant}
                onClick={(e) => {
                  e.stopPropagation();
                  onOpenChange(false);
                }}
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
                  onConfirm?.();
                }}
                disabled={confirmDisabled}
              >
                {confirmLabel}
              </Button>
            )}
          </DialogFooter>
        )}
      </DialogContent>
    </DialogPrimitives>
  );
}

export default Dialog;
