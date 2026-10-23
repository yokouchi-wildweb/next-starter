"use client";

import type { CSSProperties, SyntheticEvent } from "react";
import { useState, useCallback, useRef } from "react";

import { Button } from "@/components/Form/Button/Button";
import { Para } from "@/components/TextBlocks/Para";
import { usePrivateMediaRecovery } from "@/lib/storage/client/usePrivateMediaRecovery";

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
  const videoRef = useRef<HTMLVideoElement>(null);
  // 非公開ファイルの固定 URL(/api/storage/objects/)だけ、署名期限後の読み込み失敗から位置を保って復帰する
  // (期限が近い状態での再生・シークは先回りで読み直す)
  const recovery = usePrivateMediaRecovery(src, videoRef);
  const { handleLoadedMetadata: restorePlayback, handleError: recoverFromError } = recovery;

  const handleLoadedMetadata = useCallback(
    (event: SyntheticEvent<HTMLVideoElement>) => {
      setLoading(false);
      restorePlayback(event);
      onLoadedMetadata?.(event.currentTarget);
    },
    [onLoadedMetadata, restorePlayback],
  );

  const handleError = useCallback(
    (event: SyntheticEvent<HTMLVideoElement>) => {
      if (recoverFromError(event)) return;
      setLoading(false);
      onError?.();
    },
    [onError, recoverFromError],
  );

  return (
    <div
      className={className}
      style={{ ...style, display: "flex", alignItems: "center", justifyContent: "center" }}
    >
      <video
        ref={videoRef}
        src={recovery.src}
        controls={controls}
        muted={muted}
        loop={loop}
        preload="metadata"
        style={{ width: "100%", height: "100%", maxWidth: "100%", maxHeight: "100%", objectFit: fit }}
        onLoadedMetadata={handleLoadedMetadata}
        onError={handleError}
        onCanPlay={recovery.handleCanPlay}
        onLoadStart={recovery.handleLoadStart}
        onPlay={recovery.handlePlaybackIntent}
        onSeeking={recovery.handlePlaybackIntent}
      />
      {loading ? <span>読み込み中...</span> : null}
      {recovery.status === "failed" ? (
        <>
          <Para tone="destructive" size="sm">
            動画を読み込めませんでした
          </Para>
          <Button type="button" variant="outline" size="sm" onClick={recovery.resume}>
            再開
          </Button>
        </>
      ) : null}
    </div>
  );
};
