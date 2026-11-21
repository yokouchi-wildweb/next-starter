// src/components/Media/AppVideo/index.tsx
//
// アプリのファイルの動画を出す部品(<video> の唯一の置き場)。説明: README.md
// - src / poster の storage:// の ref は表示用 URL に直して使う(ref 以外はそのまま)
// - 非公開ファイルの固定 URL(/api/storage/objects/)は、署名期限後の読み込み失敗から位置を保って復帰し、
//   期限が近い状態での再生・シークは先回りで読み直す(usePrivateMediaRecovery の videoProps)。それ以外の URL は素の video と同じ
// - 復帰も止まったら(status "failed")動画の下に失敗の文と「再開」を出す

"use client";

import { useCallback, useRef, type CSSProperties, type SyntheticEvent } from "react";

import { Button } from "@/components/Button/Button";
import { Flex } from "@/components/Layout/Flex";
import { Para } from "@/components/TextBlocks/Para";
import { cn } from "@/lib/cn";
import { usePrivateMediaRecovery } from "@/lib/storage";
import { toStorageDisplaySrc } from "@/lib/storage";

export type AppVideoFit = "contain" | "cover";

export type AppVideoProps = {
  /** 動画の URL または保存値(storage:// の ref)。空なら src なしで描く */
  src: string | null | undefined;
  /** 表紙の画像の URL または ref */
  poster?: string | null;
  /** 読み上げの名前(aria-label)。video を描けない環境の代わりの文にもなる */
  alt?: string;
  controls?: boolean;
  muted?: boolean;
  loop?: boolean;
  preload?: "none" | "metadata" | "auto";
  /** 動画の収め方(既定 contain) */
  fit?: AppVideoFit;
  /** video 要素の class */
  className?: string;
  /** video 要素の style */
  style?: CSSProperties;
  /** メタデータを読めた時(復帰の位置戻しの後)に video 要素を渡す */
  onLoadedMetadata?: (video: HTMLVideoElement) => void;
  /** 読み込みの失敗を復帰で引き取れなかった時(復帰の対象外の URL か、復帰が止まった時) */
  onError?: () => void;
};

const FIT_CLASS: Record<AppVideoFit, string> = {
  contain: "object-contain",
  cover: "object-cover",
};

export function AppVideo({
  src,
  poster,
  alt,
  controls = true,
  muted,
  loop,
  preload,
  fit = "contain",
  className,
  style,
  onLoadedMetadata,
  onError,
}: AppVideoProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const recovery = usePrivateMediaRecovery(toStorageDisplaySrc(src), videoRef);
  // onError / onLoadedMetadata は包む(復帰で引き取ったかを見て呼び手に知らせる)。残りは videoProps をそのまま広げる
  const { videoProps, handleError: recoverFromError, handleLoadedMetadata: restorePlayback } = recovery;

  const handleLoadedMetadata = useCallback(
    (event: SyntheticEvent<HTMLVideoElement>) => {
      restorePlayback(event);
      onLoadedMetadata?.(event.currentTarget);
    },
    [onLoadedMetadata, restorePlayback],
  );

  const handleError = useCallback(
    (event: SyntheticEvent<HTMLVideoElement>) => {
      if (recoverFromError(event)) return;
      onError?.();
    },
    [onError, recoverFromError],
  );

  return (
    <>
      {/* <source> 子要素だと読み込み失敗の error が <source> 側に出て video の onError に届かないため、src は video に付ける */}
      <video
        ref={videoRef}
        data-component="AppVideo"
        {...videoProps}
        onLoadedMetadata={handleLoadedMetadata}
        onError={handleError}
        controls={controls}
        muted={muted}
        loop={loop}
        preload={preload}
        poster={toStorageDisplaySrc(poster) ?? undefined}
        aria-label={alt}
        className={cn(FIT_CLASS[fit], className)}
        style={style}
      >
        {alt ?? "video"}
      </video>
      {recovery.status === "failed" ? (
        <Flex justify="center" align="center" gap="xs" className="pt-2">
          <Para tone="destructive" size="sm">
            動画を読み込めませんでした
          </Para>
          <Button type="button" variant="outline" size="sm" onClick={recovery.resume}>
            再開
          </Button>
        </Flex>
      ) : null}
    </>
  );
}
