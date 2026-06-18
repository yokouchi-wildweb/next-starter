// src/app/play/seamless-av/_components/SeamlessAvPlayer.tsx

"use client";

import { useEffect, useState } from "react";

import { manifestToFragments, useSeamlessReel, type ReelManifest } from "@/lib/seamlessVideo";
import { Block } from "@/components/Layout/Block";
import { Flex } from "@/components/Layout/Flex";
import { Stack } from "@/components/Layout/Stack";
import { Para } from "@/components/TextBlocks";

type Props = {
  manifest: ReelManifest | null;
};

export function SeamlessAvPlayer({ manifest }: Props) {
  const { videoRef, load, play, status, error, audioEnabled, playable, complete, loaded, bufferedSec } =
    useSeamlessReel();
  const [started, setStarted] = useState(false);

  // マニフェストを progressive で読み込み(先頭が用意でき次第すぐ再生可能、残りは裏で読み込み)
  useEffect(() => {
    if (manifest) void load(manifestToFragments(manifest), { progressive: true });
  }, [manifest, load]);

  if (!manifest) {
    return (
      <Flex className="min-h-[80vh] p-6" align="center" justify="center">
        <Para tone="muted">まだ共有された動画がありません。デモ画面から保存してください。</Para>
      </Flex>
    );
  }

  const handleStart = async () => {
    setStarted(true);
    await play();
  };

  const overlayLabel =
    playable ? "タップして再生" : status === "error" ? "読み込みエラー" : "準備中...";

  return (
    <Flex className="min-h-[80vh] p-4" align="center" justify="center">
      <Stack space={3} className="w-full max-w-[420px]">
        <Block className="relative w-full overflow-clip rounded-lg bg-black">
          <video ref={videoRef} className="aspect-[9/16] w-full" controls playsInline />

          {!started && (
            <button
              type="button"
              onClick={() => void handleStart()}
              disabled={!playable}
              className="absolute inset-0 flex items-center justify-center bg-black/50 text-base font-medium text-white disabled:opacity-80"
            >
              {overlayLabel}
            </button>
          )}
        </Block>

        <Para size="xs" tone="muted" align="center">
          {started
            ? `再生中${audioEnabled ? "（音声あり）" : "（映像のみ）"}${complete ? "" : `・読み込み中 ${loaded.video}/${loaded.total}`}${
                bufferedSec > 0 ? `・先読み ${bufferedSec.toFixed(0)}s` : ""
              }`
            : playable
              ? "1タップで再生を開始します（音声を出すためタップが必要です）"
              : status === "error"
                ? ""
                : `準備中... ${loaded.total > 0 ? `${loaded.video}/${loaded.total}` : ""}`}
        </Para>

        {error && (
          <Para size="sm" tone="muted" align="center" className="text-destructive">
            {error.message}
          </Para>
        )}
      </Stack>
    </Flex>
  );
}
