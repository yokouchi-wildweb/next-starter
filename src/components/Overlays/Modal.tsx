// src/components/Overlays/Modal.tsx

"use client";

import { type CSSProperties, ReactNode } from "react";
import {
  DialogPrimitives,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/Overlays/DialogPrimitives";

export type ModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: ReactNode;
  titleSrOnly?: boolean;
  headerContent?: ReactNode;
  children?: ReactNode;
  showCloseButton?: boolean;
  className?: string;
  maxWidth?: number | string;
  minHeight?: number | string;
  /** 最大高さ。指定すると本体が overflow-y-auto でラップされる。
   * デフォルトはビューポート - 上下 4rem 余白。`null` を渡すと制限を解除できる。 */
  maxHeight?: number | string | null;
  height?: number | string;
  onCloseAutoFocus?: (event: Event) => void;
};

/** Modal 本体の既定の最大高さ。
 * DialogContent の padding (1.5rem * 2)・ヘッダ・gap などのクローム分 (~6rem) と
 * 画面端の余白 (上下 1rem ずつ) を差し引いた値。これより大きい値を渡すと
 * close ボタン等が画面外に出る可能性がある。 */
const DEFAULT_MAX_HEIGHT = "calc(100dvh - 8rem)";

export default function Modal({
  open,
  onOpenChange,
  title,
  titleSrOnly,
  headerContent,
  children,
  showCloseButton = true,
  className,
  maxWidth = 640,
  minHeight,
  maxHeight = DEFAULT_MAX_HEIGHT,
  height,
  onCloseAutoFocus,
}: ModalProps) {
  // null が明示的に渡された場合は制限を解除（後方互換用）
  const effectiveMaxHeight = maxHeight ?? undefined;
  const resolvedScrollableMinHeight =
    minHeight !== undefined ? (typeof minHeight === "number" ? `${minHeight}px` : minHeight) : undefined;
  const resolvedScrollableMaxHeight =
    effectiveMaxHeight !== undefined
      ? typeof effectiveMaxHeight === "number"
        ? `${effectiveMaxHeight}px`
        : effectiveMaxHeight
      : undefined;
  const resolvedScrollableHeight =
    height !== undefined ? (typeof height === "number" ? `${height}px` : height) : undefined;
  const shouldWrapScrollable = Boolean(
    resolvedScrollableMinHeight || resolvedScrollableMaxHeight || resolvedScrollableHeight,
  );
  const scrollableStyle: CSSProperties | undefined = shouldWrapScrollable
    ? {
        ...(resolvedScrollableMinHeight ? { minHeight: resolvedScrollableMinHeight } : {}),
        ...(resolvedScrollableMaxHeight ? { maxHeight: resolvedScrollableMaxHeight } : {}),
        ...(resolvedScrollableHeight ? { height: resolvedScrollableHeight } : {}),
      }
    : undefined;

  return (
    <DialogPrimitives open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={showCloseButton}
        className={className}
        maxWidth={maxWidth}
        onCloseAutoFocus={onCloseAutoFocus}
      >
        {title && titleSrOnly && !headerContent ? (
          <DialogTitle srOnly>{title}</DialogTitle>
        ) : (title || headerContent) ? (
          <DialogHeader>
            {title ? <DialogTitle srOnly={titleSrOnly}>{title}</DialogTitle> : null}
            {headerContent}
          </DialogHeader>
        ) : null}
        {shouldWrapScrollable ? (
          <div className="overflow-y-auto" style={scrollableStyle}>
            {children}
          </div>
        ) : (
          children
        )}
      </DialogContent>
    </DialogPrimitives>
  );
}
