"use client";

import { useCallback, useEffect, useState } from "react";

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

  useEffect(() => {
    if (!source?.file && !source?.src) {
      setMetadata(null);
    }
  }, [source?.file, source?.src]);

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
