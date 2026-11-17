// src/components/Overlays/ImageViewer/context.ts

"use client";

import { createContext, useContext, type ReactNode } from "react";

export type ImageViewerOptions = {
  /** 画像の幅（指定時はアスペクト比を維持） */
  width?: string;
  /** 画像の高さ */
  height?: string;
  /** 画像の最大幅（デフォルト: 90vw） */
  maxWidth?: string;
  /** 画像の最大高さ（デフォルト: 90vh） */
  maxHeight?: string;
  /** スケルトン表示を有効にする（デフォルト: false） */
  showSkeleton?: boolean;
  /** スケルトンのアスペクト比（デフォルト: 16/9） */
  aspectRatio?: number;
  /** 画像の下に中央寄せで描く説明文（コピーのボタン等の見た目と動きは呼び手の node）。
   * 渡すと画像の既定の最大の高さが説明文の分だけ詰まる（calc(90dvh - 4rem)、maxHeight を渡せばそれ） */
  caption?: ReactNode;
};

export type ImageViewerContextValue = {
  openImage: (src: string, alt?: string, options?: ImageViewerOptions) => void;
};

export const ImageViewerContext = createContext<ImageViewerContextValue | null>(null);

export function useImageViewer(): ImageViewerContextValue {
  const context = useContext(ImageViewerContext);
  if (!context) {
    throw new Error("useImageViewer must be used within an ImageViewerProvider");
  }
  return context;
}
