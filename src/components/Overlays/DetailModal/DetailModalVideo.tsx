// src/components/Overlays/DetailModal/DetailModalVideo.tsx
//
// DetailModal の media(type: "video")の表示。非公開ファイルの固定 URL(/api/storage/objects/)は、
// 署名期限後の読み込み失敗から位置を保って復帰し、期限が近い状態での再生・シークは先回りで読み直す(usePrivateMediaRecovery)。それ以外の URL は従来どおり。

"use client";

import { useRef } from "react";

import { Button } from "@/components/Form/Button/Button";
import { Flex } from "@/components/Layout/Flex";
import { Para } from "@/components/TextBlocks/Para";
import { usePrivateMediaRecovery } from "@/lib/storage/client/usePrivateMediaRecovery";

import type { DetailModalMedia } from "./types";

export default function DetailModalVideo({ media }: { media: DetailModalMedia }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const recovery = usePrivateMediaRecovery(media.url, videoRef);

  return (
    <>
      {/* <source> 子要素だと読み込み失敗の error が <source> 側に出て video の onError に届かないため、src は video に付ける */}
      <video
        ref={videoRef}
        src={recovery.src}
        controls
        poster={media.poster}
        aria-label={media.alt}
        className="mx-auto w-full max-w-md max-h-80 rounded-md object-contain shadow"
        onError={recovery.handleError}
        onLoadedMetadata={recovery.handleLoadedMetadata}
        onCanPlay={recovery.handleCanPlay}
        onLoadStart={recovery.handleLoadStart}
        onPlay={recovery.handlePlaybackIntent}
        onSeeking={recovery.handlePlaybackIntent}
      >
        {media.alt ?? "video preview"}
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
