// src/lib/seamlessVideo/components/SeamlessVideoPlayer.tsx
//
// fmp4 フラグメント配列を渡すだけで継ぎ目なく連結再生するドロップインコンポーネント。
// sources の参照が変わると再読み込みする。呼び出し側で sources を memo 化することを推奨。

"use client";

import { useEffect, useRef } from "react";

import { cn } from "@/lib/cn";

import type { SeamlessFragmentSource } from "../types";
import { useSeamlessVideo } from "../hooks/useSeamlessVideo";

export type SeamlessVideoPlayerProps = {
  /** 連結するフラグメント(再生したい順) */
  sources: SeamlessFragmentSource[];
  /** 連結に使う MIME。省略時はフラグメントから自動推定 */
  mimeType?: string;
  className?: string;
  controls?: boolean;
  autoPlay?: boolean;
  muted?: boolean;
  /** 連結全体をループ再生する(ended で先頭へシーク) */
  loop?: boolean;
  playsInline?: boolean;
  /** 読み込み進捗 */
  onProgress?: (appended: number, total: number) => void;
  /** 全フラグメントの連結が完了 */
  onReady?: () => void;
  onError?: (error: Error) => void;
};

export function SeamlessVideoPlayer({
  sources,
  mimeType,
  className,
  controls = true,
  autoPlay = false,
  muted = true,
  loop = false,
  playsInline = true,
  onProgress,
  onReady,
  onError,
}: SeamlessVideoPlayerProps) {
  const { videoRef, load, status, error, progress } = useSeamlessVideo({ mimeType });

  // sources の参照変化で再読み込み
  useEffect(() => {
    if (sources.length > 0) {
      void load(sources);
    }
  }, [sources, load]);

  // 進捗・完了・エラーを親へ通知(ref 更新はコミット後に行う)
  const callbacksRef = useRef({ onProgress, onReady, onError });
  useEffect(() => {
    callbacksRef.current = { onProgress, onReady, onError };
  });

  useEffect(() => {
    callbacksRef.current.onProgress?.(progress.appended, progress.total);
  }, [progress]);

  useEffect(() => {
    if (status === "ready") callbacksRef.current.onReady?.();
    if (status === "error" && error) callbacksRef.current.onError?.(error);
  }, [status, error]);

  // MSE のループは ended でのシークで実現する(loop 属性は連結ストリームで安定しないため)
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !loop) return;
    const onEnded = () => {
      video.currentTime = 0;
      void video.play().catch(() => {});
    };
    video.addEventListener("ended", onEnded);
    return () => video.removeEventListener("ended", onEnded);
  }, [loop, videoRef]);

  return (
    <video
      ref={videoRef}
      className={cn("h-full w-full", className)}
      controls={controls}
      autoPlay={autoPlay}
      muted={muted}
      playsInline={playsInline}
    />
  );
}
