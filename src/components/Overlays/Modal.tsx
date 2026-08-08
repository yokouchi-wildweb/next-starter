// src/components/Overlays/Modal.tsx

"use client";

import { type CSSProperties, ReactNode } from "react";
import {
  DialogPrimitives,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/Overlays/DialogPrimitives";
import { cn } from "@/lib/cn";

export type ModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: ReactNode;
  titleSrOnly?: boolean;
  headerContent?: ReactNode;
  children?: ReactNode;
  /** スクロール領域の外側に描画される常時表示フッター（確定/キャンセル等のアクションバー）。
   * 区切り線・余白・背景は Modal 側が持つため、コンシューマはボタン列だけを渡せばよい。
   * scrollable / 非 scrollable どちらのモードでも本体スクロールに追従せず常に表示される。 */
  footer?: ReactNode;
  showCloseButton?: boolean;
  className?: string;
  maxWidth?: number | string;
  minHeight?: number | string;
  /** 最大高さ。指定すると本体が overflow-y-auto でラップされる。
   * デフォルトはビューポート - 上下 4rem 余白。DEFAULT_MAX_HEIGHT を超える値は
   * 内部で min() クランプされるため、過大な値（90vh 等）を渡しても画面外にはみ出さない。
   * `null` を渡すとクランプごと制限を解除できる。 */
  maxHeight?: number | string | null;
  height?: number | string;
  onCloseAutoFocus?: (event: Event) => void;
};

/** Modal 本体の既定の最大高さ。
 * DialogContent の padding (1.5rem * 2)・ヘッダ・gap などのクローム分 (~6rem) と
 * 画面端の余白 (上下 1rem ずつ) を差し引いた値。
 * maxHeight / height にこれを超える値が渡された場合は min() でこの値にクランプされる。 */
const DEFAULT_MAX_HEIGHT = "calc(100dvh - 8rem)";

/** DialogContent（モーダルの箱全体）の最大高さ。
 * footer やヘッダなどクロームの実高は静的に知り得ないため、箱全体をビューポート内に
 * 収める上限を別途持つ。超過時は overflow-y-auto の本体行が縮んでスクロールするため、
 * close ボタンや footer が画面外に押し出されることは構造的に起きない。 */
const CONTENT_MAX_HEIGHT_CLASS = "max-h-[calc(100dvh-2rem)]";

export default function Modal({
  open,
  onOpenChange,
  title,
  titleSrOnly,
  headerContent,
  children,
  footer,
  showCloseButton = true,
  className,
  maxWidth = 640,
  minHeight,
  maxHeight = DEFAULT_MAX_HEIGHT,
  height,
  onCloseAutoFocus,
}: ModalProps) {
  // null が明示的に渡された場合は制限とクランプを解除（後方互換用）
  const effectiveMaxHeight = maxHeight ?? undefined;
  const clampEnabled = maxHeight !== null;
  const toCssSize = (value: number | string) =>
    typeof value === "number" ? `${value}px` : value;
  // DEFAULT_MAX_HEIGHT を超える指定値をクランプ（クローム分の上乗せによる画面外はみ出しを防ぐ）
  const clampToViewport = (value: string) =>
    clampEnabled && value !== DEFAULT_MAX_HEIGHT ? `min(${value}, ${DEFAULT_MAX_HEIGHT})` : value;

  const resolvedScrollableMinHeight =
    minHeight !== undefined ? toCssSize(minHeight) : undefined;
  const resolvedScrollableMaxHeight =
    effectiveMaxHeight !== undefined ? clampToViewport(toCssSize(effectiveMaxHeight)) : undefined;
  const resolvedScrollableHeight =
    height !== undefined ? clampToViewport(toCssSize(height)) : undefined;
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
        className={cn(clampEnabled && CONTENT_MAX_HEIGHT_CLASS, className)}
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
        {footer != null ? (
          <DialogFooter className="border-t pt-4">{footer}</DialogFooter>
        ) : null}
      </DialogContent>
    </DialogPrimitives>
  );
}
