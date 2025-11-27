"use client";

import { useCallback, useEffect, useState } from "react";

import type { MediaSource, VideoMetadata } from "../types";
import { resolveMediaOrientation } from "../types";

const SECOND = 1000;

const formatDuration = (durationSec: number) => {
  if (!Number.isFinite(durationSec) || durationSec < 0) return "0:00";
  const totalMilliseconds = Math.round(durationSec * SECOND);
  const totalSeconds = Math.floor(totalMilliseconds / SECOND);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  if (hours > 0) {
    return `${hours}:${String(remainingMinutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  }
  return `${remainingMinutes}:${String(seconds).padStart(2, "0")}`;
};

export type UseVideoMetadataOptions = {
  source?: MediaSource;
};

export type UseVideoMetadataResult = {
  metadata: VideoMetadata | null;
  handleVideoMetadata: (element: HTMLVideoElement) => void;
  resetMetadata: () => void;
};

export function useVideoMetadata({ source }: UseVideoMetadataOptions = {}): UseVideoMetadataResult {
  const [metadata, setMetadata] = useState<VideoMetadata | null>(null);

  const resetMetadata = useCallback(() => {
    setMetadata(null);
  }, []);

  useEffect(() => {
    if (!source?.file && !source?.src) {
      setMetadata(null);
    }
  }, [source?.file, source?.src]);

  const handleVideoMetadata = useCallback(
    (element: HTMLVideoElement) => {
      const width = element.videoWidth || 0;
      const height = element.videoHeight || 0;
      const durationSec = Number.isFinite(element.duration) ? element.duration : 0;
      setMetadata({
        width,
        height,
        aspectRatio: width && height ? width / height : 0,
        orientation: resolveMediaOrientation(width, height),
        durationSec,
        durationFormatted: formatDuration(durationSec),
        mimeType: source?.file?.type ?? source?.mimeType ?? null,
        sizeBytes: source?.file?.size ?? null,
        src: element.currentSrc ?? source?.src ?? null,
      });
    },
    [source?.file, source?.mimeType, source?.src],
  );

  return { metadata, handleVideoMetadata, resetMetadata };
}
