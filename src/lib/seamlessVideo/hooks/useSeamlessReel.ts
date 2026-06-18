// src/lib/seamlessVideo/hooks/useSeamlessReel.ts
//
// SeamlessReel(映像+音声 結合プレイヤー)を React から扱うためのフック。

"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import type { FragmentFetcher, ReelFragment, SeamlessFragmentSource } from "../types";
import { SeamlessReel, type SeamlessReelOptions, type SeamlessReelState } from "../core/SeamlessReel";

export type SeamlessReelStatus = "idle" | "loading" | "ready" | "error";

export type UseSeamlessReelOptions = Pick<
  SeamlessReelOptions,
  "mimeType" | "syncThreshold" | "hardResyncThreshold" | "syncIntervalMs" | "loop"
> & {
  /** URL ソースのバイト取得を差し替える(認証/キャッシュ/CDN 等) */
  fetcher?: FragmentFetcher;
  onLog?: (message: string) => void;
  onDrift?: (driftSec: number, corrected: boolean) => void;
  onPlay?: () => void;
  onPause?: () => void;
  onEnded?: () => void;
};

export type SeamlessReelLoaded = { video: number; audio: number; total: number };

export type UseSeamlessReelResult = {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  /** フラグメント(映像+音声)を読み込み連結する。progressive=true で先頭準備時点から再生可能に。open=true で動的継ぎ足し可 */
  load: (fragments: ReelFragment[], opts?: { progressive?: boolean; open?: boolean }) => Promise<void>;
  play: () => Promise<void>;
  pause: () => void;
  reset: () => void;
  /** 実行時にフラグメントを継ぎ足す(load を open:true で行った場合) */
  appendFragment: (fragment: ReelFragment) => Promise<void>;
  /** open ストリームを確定する */
  endReel: () => Promise<void>;
  /** 指定フラグメント先頭へシーク */
  seekToFragment: (index: number) => void;
  /** フラグメント音声の音量(0..) */
  setVolume: (v: number) => void;
  /** フラグメント音声を target へ durationSec でフェード */
  fade: (target: number, durationSec: number) => void;
  /** 連続 BGM を設定(再生は play() か playBgm()) */
  setBgm: (source: SeamlessFragmentSource, opts?: { loop?: boolean; volume?: number }) => Promise<void>;
  playBgm: () => Promise<void>;
  stopBgm: () => void;
  setBgmVolume: (v: number) => void;
  fadeBgm: (target: number, durationSec: number) => void;
  /** status==="ready" は「再生可能(playable)」を意味する */
  status: SeamlessReelStatus;
  error: Error | null;
  progress: { appended: number; total: number };
  audioEnabled: boolean;
  /** 再生可能になったか(progressive では先頭準備時点で true) */
  playable: boolean;
  /** 全フラグメントの読み込み完了 */
  complete: boolean;
  /** 読み込み済み数 */
  loaded: SeamlessReelLoaded;
  /** 現在位置から先のバッファ秒数 */
  bufferedSec: number;
  /** 再生中フラグメント index(不明は -1) */
  currentFragment: number;
};

export function useSeamlessReel(options: UseSeamlessReelOptions = {}): UseSeamlessReelResult {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const reelRef = useRef<SeamlessReel | null>(null);

  const [status, setStatus] = useState<SeamlessReelStatus>("idle");
  const [error, setError] = useState<Error | null>(null);
  const [progress, setProgress] = useState({ appended: 0, total: 0 });
  const [audioEnabled, setAudioEnabled] = useState(false);
  const [playable, setPlayable] = useState(false);
  const [complete, setComplete] = useState(false);
  const [loaded, setLoaded] = useState<SeamlessReelLoaded>({ video: 0, audio: 0, total: 0 });
  const [bufferedSec, setBufferedSec] = useState(0);
  const [currentFragment, setCurrentFragment] = useState(-1);

  const optionsRef = useRef(options);
  useEffect(() => {
    optionsRef.current = options;
  });

  const applyState = useCallback((s: SeamlessReelState) => {
    setPlayable(s.playable);
    setComplete(s.complete);
    setLoaded({ video: s.loadedVideo, audio: s.loadedAudio, total: s.total });
    setBufferedSec(s.bufferedSec);
    setCurrentFragment(s.currentFragment);
  }, []);

  const reset = useCallback(() => {
    reelRef.current?.destroy();
    reelRef.current = null;
    setStatus("idle");
    setError(null);
    setProgress({ appended: 0, total: 0 });
    setAudioEnabled(false);
    setPlayable(false);
    setComplete(false);
    setLoaded({ video: 0, audio: 0, total: 0 });
    setBufferedSec(0);
    setCurrentFragment(-1);
  }, []);

  const load = useCallback(
    async (fragments: ReelFragment[], opts?: { progressive?: boolean; open?: boolean }) => {
      const video = videoRef.current;
      if (!video) return;
      reelRef.current?.destroy();
      setError(null);
      setStatus("loading");
      setProgress({ appended: 0, total: fragments.length });
      setPlayable(false);
      setComplete(false);
      setLoaded({ video: 0, audio: 0, total: fragments.length });

      const opt = optionsRef.current;
      const reel = new SeamlessReel(video, {
        mimeType: opt.mimeType,
        fetcher: opt.fetcher,
        syncThreshold: opt.syncThreshold,
        hardResyncThreshold: opt.hardResyncThreshold,
        syncIntervalMs: opt.syncIntervalMs,
        loop: opt.loop,
        onLog: opt.onLog,
        onDrift: opt.onDrift,
        onPlay: opt.onPlay,
        onPause: opt.onPause,
        onEnded: opt.onEnded,
        onFragmentAppended: (appended, total) => setProgress({ appended, total }),
        onState: applyState,
        onError: (e) => {
          setError(e);
          setStatus("error");
        },
      });
      reelRef.current = reel;

      try {
        await reel.load(fragments, opts);
        setAudioEnabled(reel.audioEnabled);
        setStatus("ready"); // playable に達したら ready
      } catch (e) {
        setError(e instanceof Error ? e : new Error(String(e)));
        setStatus("error");
      }
    },
    [applyState],
  );

  const play = useCallback(async () => {
    try {
      await reelRef.current?.play();
    } catch (e) {
      setError(e instanceof Error ? e : new Error(String(e)));
      setStatus("error");
    }
  }, []);

  const pause = useCallback(() => {
    reelRef.current?.pause();
  }, []);

  const appendFragment = useCallback(async (fragment: ReelFragment) => {
    await reelRef.current?.appendFragment(fragment);
  }, []);
  const endReel = useCallback(async () => {
    await reelRef.current?.endReel();
  }, []);
  const seekToFragment = useCallback((index: number) => {
    reelRef.current?.seekToFragment(index);
  }, []);
  const setVolume = useCallback((v: number) => {
    reelRef.current?.setVolume(v);
  }, []);
  const fade = useCallback((target: number, durationSec: number) => {
    reelRef.current?.fade(target, durationSec);
  }, []);
  const setBgm = useCallback(async (source: SeamlessFragmentSource, opts?: { loop?: boolean; volume?: number }) => {
    await reelRef.current?.setBgm(source, opts);
  }, []);
  const playBgm = useCallback(async () => {
    await reelRef.current?.playBgm();
  }, []);
  const stopBgm = useCallback(() => {
    reelRef.current?.stopBgm();
  }, []);
  const setBgmVolume = useCallback((v: number) => {
    reelRef.current?.setBgmVolume(v);
  }, []);
  const fadeBgm = useCallback((target: number, durationSec: number) => {
    reelRef.current?.fadeBgm(target, durationSec);
  }, []);

  useEffect(() => {
    return () => {
      reelRef.current?.destroy();
      reelRef.current = null;
    };
  }, []);

  return {
    videoRef,
    load,
    play,
    pause,
    reset,
    appendFragment,
    endReel,
    seekToFragment,
    setVolume,
    fade,
    setBgm,
    playBgm,
    stopBgm,
    setBgmVolume,
    fadeBgm,
    status,
    error,
    progress,
    audioEnabled,
    playable,
    complete,
    loaded,
    bufferedSec,
    currentFragment,
  };
}
