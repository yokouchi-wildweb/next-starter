"use client";

import type { CSSProperties, SyntheticEvent } from "react";
import { useState, useCallback } from "react";

export type VideoPreviewProps = {
  src: string;
  className?: string;
  style?: CSSProperties;
  controls?: boolean;
  muted?: boolean;
  loop?: boolean;
  onLoadedMetadata?: (video: HTMLVideoElement) => void;
  onError?: () => void;
};

export const VideoPreview = ({
  src,
  className,
  style,
  controls = true,
  muted = true,
  loop = false,
  onLoadedMetadata,
  onError,
}: VideoPreviewProps) => {
  const [loading, setLoading] = useState(true);

  const handleLoadedMetadata = useCallback(
    (event: SyntheticEvent<HTMLVideoElement>) => {
      setLoading(false);
      onLoadedMetadata?.(event.currentTarget);
    },
    [onLoadedMetadata],
  );

  const handleError = useCallback(() => {
    setLoading(false);
    onError?.();
  }, [onError]);

  return (
    <div
      className={className}
      style={{ ...style, display: "flex", alignItems: "center", justifyContent: "center" }}
    >
      <video
        src={src}
        controls={controls}
        muted={muted}
        loop={loop}
        preload="metadata"
        style={{ width: "100%", height: "100%", maxWidth: "100%", maxHeight: "100%", objectFit: "contain" }}
        onLoadedMetadata={handleLoadedMetadata}
        onError={handleError}
      />
      {loading ? <span>読み込み中...</span> : null}
    </div>
  );
};
