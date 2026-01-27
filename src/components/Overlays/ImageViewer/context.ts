// src/components/Overlays/ImageViewer/context.ts

"use client";

import { createContext, useContext } from "react";

export type ImageViewerOptions = {
  /** 画像の幅（指定時はアスペクト比を維持） */
  width?: string;
  /** 画像の高さ */
  height?: string;
  /** 画像の最大幅（デフォルト: 90vw） */
  maxWidth?: string;
  /** 画像の最大高さ（デフォルト: 90vh） */
  maxHeight?: string;
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
