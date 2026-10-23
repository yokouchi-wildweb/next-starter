// src/lib/storage/client/usePrivateMediaRecovery.ts
//
// 非公開の動画・音声（固定 URL /api/storage/objects/<id>）の、署名期限後の復帰処理。
// 固定 URL は都度認可して短期署名 URL へ 302 する。ブラウザは 302 先の署名 URL を使い回して Range 取得するため、
// 期限（STORAGE_CONFIG.readTtlSec の video / audio）を過ぎた後のシークで読み込みに失敗しうる。
// 失敗したら位置・再生状態・速度を覚え、固定 URL に非永続の再取得 query を付けて読み直し、同じ位置へ戻す。
//
// - src が固定 URL でなければ何もしない（旧 URL・公開 URL はそのまま）
// - 自動復帰は 1 回の失敗に 1 回だけ。復帰後に再生できる状態へ戻れば次の失敗でまた 1 回復帰する
// - 復帰直後にまた失敗したら status "failed" で止まる（無限に再試行しない）。呼び出し側はエラーと再開操作を出し、
//   再開操作で resume() を呼ぶ（読み直して再生できる状態に戻れば、自動復帰 1 回分が戻る）
// - 許可を失った場合（logout・退室・削除で 401/404）も HTTP 状態は見ずに同じ扱いになる: 自動では再試行せず止まる
// - 全ページの署名更新の仕組みは作らない（失敗したその要素だけを読み直す）

"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { RefObject, SyntheticEvent } from "react";

import { isPrivateObjectPath } from "../ref";

/** 再取得用の query 名（非永続。DB や DOM の保存値には使わない） */
export const MEDIA_RETRY_QUERY = "_r";

export type PrivateMediaRecoveryStatus = "idle" | "recovering" | "failed";

type SavedPlayback = { currentTime: number; paused: boolean; playbackRate: number };

/** 固定 URL に再取得用の query を付ける（既存の query は残す） */
export function withMediaRetryQuery(src: string, key: string | number): string {
  const separator = src.includes("?") ? "&" : "?";
  return `${src}${separator}${MEDIA_RETRY_QUERY}=${encodeURIComponent(String(key))}`;
}

export type PrivateMediaRecovery = {
  /** media 要素（または <source>）に渡す src。復帰中は再取得 query 付き */
  src: string | undefined;
  status: PrivateMediaRecoveryStatus;
  /**
   * media 要素の onError から呼ぶ。復帰を始めたら true（呼び出し側はエラー表示をしない）。
   * 固定 URL でない・復帰を使い切った場合は false
   */
  handleError: (event: SyntheticEvent<HTMLMediaElement>) => boolean;
  /** media 要素の onLoadedMetadata から呼ぶ（保存した位置・速度に戻す） */
  handleLoadedMetadata: (event: SyntheticEvent<HTMLMediaElement>) => void;
  /** media 要素の onCanPlay から呼ぶ（復帰が済んだら次の失敗に備えて自動復帰を戻す） */
  handleCanPlay: () => void;
  /** status "failed" からの再開操作。最後に覚えた位置で読み直す（それが失敗したらまた "failed" で止まる） */
  resume: () => void;
};

/**
 * @param src 表示用 URL（resolveStorageSrc の結果）
 * @param mediaRef 対象の media 要素。<source> の src を差し替えたときの load() に使う
 */
export function usePrivateMediaRecovery(
  src: string | null | undefined,
  mediaRef: RefObject<HTMLMediaElement | null>,
): PrivateMediaRecovery {
  const enabled = isPrivateObjectPath(src);
  const [retryKey, setRetryKey] = useState<number | null>(null);
  const [status, setStatus] = useState<PrivateMediaRecoveryStatus>("idle");
  const savedRef = useRef<SavedPlayback | null>(null);
  const restoringRef = useRef(false);
  const autoUsedRef = useRef(false);

  // src が変わったら最初の状態に戻す（別のファイル）
  const [trackedSrc, setTrackedSrc] = useState(src);
  if (trackedSrc !== src) {
    setTrackedSrc(src);
    setRetryKey(null);
    setStatus("idle");
  }
  useEffect(() => {
    savedRef.current = null;
    restoringRef.current = false;
    autoUsedRef.current = false;
  }, [src]);

  // 再取得 query を付けたら読み直す。要素の src 属性の差し替えはブラウザが自動で読み直すが、
  // <source> の src 差し替えは load() が無いと反映されない
  useEffect(() => {
    const media = mediaRef.current;
    if (retryKey === null || !media || media.hasAttribute("src")) return;
    media.load();
  }, [retryKey, mediaRef]);

  const reload = useCallback((media: HTMLMediaElement | null) => {
    if (media) {
      savedRef.current = {
        currentTime: media.currentTime,
        paused: media.paused,
        playbackRate: media.playbackRate,
      };
    }
    restoringRef.current = true;
    setStatus("recovering");
    setRetryKey(Date.now());
  }, []);

  const handleError = useCallback(
    (event: SyntheticEvent<HTMLMediaElement>) => {
      if (!enabled) return false;
      if (autoUsedRef.current) {
        restoringRef.current = false;
        setStatus("failed");
        return false;
      }
      autoUsedRef.current = true;
      reload(event.currentTarget);
      return true;
    },
    [enabled, reload],
  );

  const handleLoadedMetadata = useCallback((event: SyntheticEvent<HTMLMediaElement>) => {
    const saved = savedRef.current;
    if (!restoringRef.current || !saved) return;
    const media = event.currentTarget;
    media.playbackRate = saved.playbackRate;
    media.currentTime = saved.currentTime;
    if (!saved.paused) {
      // 自動再生の制限で拒否されても復帰は済んでいる（利用者が再生を押せばよい）
      void media.play().catch(() => undefined);
    }
  }, []);

  const handleCanPlay = useCallback(() => {
    if (!restoringRef.current) return;
    restoringRef.current = false;
    autoUsedRef.current = false;
    setStatus("idle");
  }, []);

  const resume = useCallback(() => {
    if (!enabled) return;
    autoUsedRef.current = true;
    reload(null);
  }, [enabled, reload]);

  const resolvedSrc = src ? (enabled && retryKey !== null ? withMediaRetryQuery(src, retryKey) : src) : undefined;

  return { src: resolvedSrc, status, handleError, handleLoadedMetadata, handleCanPlay, resume };
}
