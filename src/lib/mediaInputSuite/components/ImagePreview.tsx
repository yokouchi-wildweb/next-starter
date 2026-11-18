"use client";

import { useState, useCallback } from "react";
import type { CSSProperties, SyntheticEvent } from "react";
import { Block } from "@/components/Layout/Block";
import { PreviewImage } from "@/components/Media/PreviewImage";
import { Span } from "@/components/TextBlocks";

export type ImagePreviewProps = {
  src: string;
  alt?: string;
  className?: string;
  style?: CSSProperties;
  /** 画像の収め方（既定: contain） */
  fit?: "contain" | "cover";
  onLoad?: (element: HTMLImageElement) => void;
  onError?: (element: HTMLImageElement) => void;
};

export const ImagePreview = ({
  src,
  alt = "preview",
  className,
  style,
  fit = "contain",
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
    <Block
      className={className}
      style={{ ...style, display: "flex", alignItems: "center", justifyContent: "center" }}
    >
      {/* 選択直後のローカルファイル(blob: URL)のプレビューも表示するので PreviewImage(素の img)。
          onLoad で読み込み中の表示を外すので lazy にしない(PreviewImage の既定 = eager)。decode だけ非同期 */}
      <PreviewImage
        src={src}
        alt={alt}
        style={{
          width: "100%",
          height: "100%",
          maxWidth: "100%",
          maxHeight: "100%",
          objectFit: fit,
          opacity: loading ? 0 : 1,
        }}
        onLoad={handleLoad}
        onError={handleError}
      />
      {loading ? <Span inline>読み込み中...</Span> : null}
    </Block>
  );
};
