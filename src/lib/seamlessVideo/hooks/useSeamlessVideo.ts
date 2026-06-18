// src/lib/seamlessVideo/hooks/useSeamlessVideo.ts
//
// SeamlessSource(連結再生コア)を React から扱うためのフック。
// video 要素の ref と load/append/reset 操作、進捗・状態を提供する。

"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import type { FragmentFetcher, SeamlessFragmentSource } from "../types";
import { SeamlessSource } from "../core/SeamlessSource";

export type SeamlessStatus = "idle" | "loading" | "ready" | "error";

export type UseSeamlessVideoOptions = {
  /** 連結に使う MIME。省略時はフラグメントから自動推定 */
  mimeType?: string;
  /** URL ソースのバイト取得を差し替える(認証/キャッシュ/CDN 等) */
  fetcher?: FragmentFetcher;
  /** デバッグ用ログのハンドラ */
  onLog?: (message: string) => void;
};

export type UseSeamlessVideoResult = {
  /** <video> に渡す ref */
  videoRef: React.RefObject<HTMLVideoElement | null>;
  /** プレイリスト全体を読み込み連結する */
  load: (sources: SeamlessFragmentSource[]) => Promise<void>;
  /** 実行時に 1 フラグメントを末尾へ追加する */
  append: (source: SeamlessFragmentSource) => Promise<void>;
  /** 状態をリセットし再生機構を破棄する */
  reset: () => void;
  status: SeamlessStatus;
  error: Error | null;
  progress: { appended: number; total: number };
};

export function useSeamlessVideo(options: UseSeamlessVideoOptions = {}): UseSeamlessVideoResult {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const sourceRef = useRef<SeamlessSource | null>(null);

  const [status, setStatus] = useState<SeamlessStatus>("idle");
  const [error, setError] = useState<Error | null>(null);
  const [progress, setProgress] = useState({ appended: 0, total: 0 });

  // options を ref に保持し、コールバックの依存を安定させる(ref 更新はコミット後に行う)
  const optionsRef = useRef(options);
  useEffect(() => {
    optionsRef.current = options;
  });

  const createSource = useCallback((video: HTMLVideoElement) => {
    return new SeamlessSource(video, {
      mimeType: optionsRef.current.mimeType,
      fetcher: optionsRef.current.fetcher,
      onLog: optionsRef.current.onLog,
      onFragmentAppended: (appended, total) => setProgress({ appended, total }),
      onError: (e) => {
        setError(e);
        setStatus("error");
      },
    });
  }, []);

  const reset = useCallback(() => {
    sourceRef.current?.destroy();
    sourceRef.current = null;
    setStatus("idle");
    setError(null);
    setProgress({ appended: 0, total: 0 });
  }, []);

  const load = useCallback(
    async (sources: SeamlessFragmentSource[]) => {
      const video = videoRef.current;
      if (!video) return;
      sourceRef.current?.destroy();
      setError(null);
      setStatus("loading");
      setProgress({ appended: 0, total: sources.length });

      const source = createSource(video);
      sourceRef.current = source;
      try {
        await source.load(sources);
        setStatus("ready");
      } catch (e) {
        setError(e instanceof Error ? e : new Error(String(e)));
        setStatus("error");
      }
    },
    [createSource],
  );

  const append = useCallback(
    async (source: SeamlessFragmentSource) => {
      const video = videoRef.current;
      if (!video) return;
      if (!sourceRef.current) {
        sourceRef.current = createSource(video);
        setStatus("loading");
      }
      try {
        await sourceRef.current.append(source);
      } catch (e) {
        setError(e instanceof Error ? e : new Error(String(e)));
        setStatus("error");
      }
    },
    [createSource],
  );

  // アンマウント時にリソース解放
  useEffect(() => {
    return () => {
      sourceRef.current?.destroy();
      sourceRef.current = null;
    };
  }, []);

  return { videoRef, load, append, reset, status, error, progress };
}
