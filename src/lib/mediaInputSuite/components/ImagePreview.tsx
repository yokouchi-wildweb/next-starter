"use client";

import { useState, useCallback } from "react";
import type { CSSProperties, SyntheticEvent } from "react";

export type ImagePreviewProps = {
  src: string;
  alt?: string;
  className?: string;
  style?: CSSProperties;
  onLoad?: (event: SyntheticEvent<HTMLImageElement>) => void;
  onError?: (event: SyntheticEvent<HTMLImageElement>) => void;
};

export const ImagePreview = ({
  src,
  alt = "preview",
  className,
  style,
  onLoad,
  onError,
}: ImagePreviewProps) => {
  const [loading, setLoading] = useState(true);

  const handleLoad = useCallback(
    (event: SyntheticEvent<HTMLImageElement>) => {
      setLoading(false);
      onLoad?.(event.currentTarget);
    },
    [onLoad],
  );

  const handleError = useCallback(
    (event: SyntheticEvent<HTMLImageElement>) => {
      setLoading(false);
      onError?.(event.currentTarget);
    },
    [onError],
  );

  return (
    <div
      className={className}
      style={{ ...style, display: "flex", alignItems: "center", justifyContent: "center" }}
    >
      <img
        src={src}
        alt={alt}
        style={{
          width: "100%",
          height: "100%",
          maxWidth: "100%",
          maxHeight: "100%",
          objectFit: "contain",
          opacity: loading ? 0 : 1,
        }}
        onLoad={handleLoad}
        onError={handleError}
      />
      {loading ? <span>読み込み中...</span> : null}
    </div>
  );
};
