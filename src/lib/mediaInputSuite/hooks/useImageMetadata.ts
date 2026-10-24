"use client";

import { useCallback, useState } from "react";

import type { ImageMetadata, MediaSource } from "../types";
import { resolveMediaOrientation } from "../types";

export type UseImageMetadataOptions = {
  source?: MediaSource;
};

export type UseImageMetadataResult = {
  metadata: ImageMetadata | null;
  handleImageLoad: (element: HTMLImageElement) => void;
  resetMetadata: () => void;
};

export function useImageMetadata({ source }: UseImageMetadataOptions = {}): UseImageMetadataResult {
  const [metadata, setMetadata] = useState<ImageMetadata | null>(null);

  const resetMetadata = useCallback(() => {
    setMetadata(null);
  }, []);

  // ソースが空になったらメタデータを消す(前回の render のソースと比べて render 中に調整する)
  const sourceFile = source?.file;
  const sourceSrc = source?.src;
  const [prevSource, setPrevSource] = useState({ file: sourceFile, src: sourceSrc });
  if (prevSource.file !== sourceFile || prevSource.src !== sourceSrc) {
    setPrevSource({ file: sourceFile, src: sourceSrc });
    if (!sourceFile && !sourceSrc) {
      setMetadata(null);
    }
  }

  const handleImageLoad = useCallback(
    (element: HTMLImageElement) => {
      const width = element.naturalWidth || 0;
      const height = element.naturalHeight || 0;
      setMetadata({
        width,
        height,
        aspectRatio: width && height ? width / height : 0,
        orientation: resolveMediaOrientation(width, height),
        mimeType: source?.file?.type ?? source?.mimeType ?? null,
        sizeBytes: source?.file?.size ?? null,
        src: element.currentSrc ?? source?.src ?? null,
      });
    },
    [source?.file, source?.mimeType, source?.src],
  );

  return { metadata, handleImageLoad, resetMetadata };
}
