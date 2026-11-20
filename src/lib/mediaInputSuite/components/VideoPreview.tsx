"use client";

// 選んだ・保存済みの動画の下見。動画の描画と非公開ファイルの復帰は Media/AppVideo、ここは枠と「読み込み中」の文だけ

import type { CSSProperties } from "react";
import { useCallback, useState } from "react";

import { Block } from "@/components/Layout/Block";
import { AppVideo } from "@/components/Media/AppVideo";
import { Span } from "@/components/TextBlocks/Span";

export type VideoPreviewProps = {
  src: string;
  className?: string;
  style?: CSSProperties;
  controls?: boolean;
  muted?: boolean;
  loop?: boolean;
  /** 動画の収め方（既定: contain） */
  fit?: "contain" | "cover";
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
  fit = "contain",
  onLoadedMetadata,
  onError,
}: VideoPreviewProps) => {
  const [loading, setLoading] = useState(true);

  const handleLoadedMetadata = useCallback(
    (video: HTMLVideoElement) => {
      setLoading(false);
      onLoadedMetadata?.(video);
    },
    [onLoadedMetadata],
  );

  const handleError = useCallback(() => {
    setLoading(false);
    onError?.();
  }, [onError]);

  return (
    <Block
      className={className}
      style={{ ...style, display: "flex", alignItems: "center", justifyContent: "center" }}
    >
      <AppVideo
        src={src}
        controls={controls}
        muted={muted}
        loop={loop}
        preload="metadata"
        fit={fit}
        style={{ width: "100%", height: "100%", maxWidth: "100%", maxHeight: "100%" }}
        onLoadedMetadata={handleLoadedMetadata}
        onError={handleError}
      />
      {loading ? <Span inline>読み込み中...</Span> : null}
    </Block>
  );
};
