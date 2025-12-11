// src/components/Overlays/Modal.tsx

"use client";

import { type CSSProperties, ReactNode } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/Overlays/Dialog";

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
  maxHeight?: number | string;
  height?: number | string;
};

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
  maxHeight,
  height,
}: ModalProps) {
  const resolvedScrollableMinHeight =
    minHeight !== undefined ? (typeof minHeight === "number" ? `${minHeight}px` : minHeight) : undefined;
  const resolvedScrollableMaxHeight =
    maxHeight !== undefined ? (typeof maxHeight === "number" ? `${maxHeight}px` : maxHeight) : undefined;
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
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={showCloseButton}
        className={className}
        maxWidth={maxWidth}
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
    </Dialog>
  );
}
