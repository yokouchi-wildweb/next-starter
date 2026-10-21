"use client";

// src/features/core/pairedDevice/hooks/useStartDevicePairing.ts
//
// 端末側から始めるペアリング（端末がコード / QR を表示し、管理者が自分の端末で承認する）。
// 開始 → 承認の確認（ポーリング）→ 登録完了までを 1 つのフックにまとめる。
// 画面は phase で表示を切り替え、code（と承認ページの URL を入れた QR）を出すだけでよい。
//
// 一時的な失敗（429・通信断・5xx）では止まらず、間隔を空けて確認を続ける（phase は waiting のまま、lastError に残す）。
// 期限切れの判定はサーバーの応答だけを信じる（端末の時計がずれていても誤判定しない）。

import { useCallback, useEffect, useRef, useState } from "react";
import { useSWRConfig } from "swr";

import type { SessionDevice } from "@/features/core/pairedDevice/entities/model";
import {
  fetchSessionDevice,
  pollDevicePairing,
  startDevicePairing,
} from "@/features/core/pairedDevice/services/client/pairedDeviceClient";
import { getPairedDeviceErrorReason } from "@/features/core/pairedDevice/utils/errorReason";
import { useDomainMutation } from "@/lib/crud/hooks";
import { isHttpError } from "@/lib/errors";

import { SESSION_DEVICE_KEY } from "./keys";

/**
 * - idle: 未開始（autoStart: false のとき）
 * - starting: コードを発行中
 * - waiting: コードを表示して承認待ち（ポーリング中。一時的な失敗は lastError に出る）
 * - completed: 承認されてこの端末が登録された（device に端末の情報）
 * - expired: コードの有効期限切れ（restart で新しいコードを出す）
 * - canceled: 管理者が取り消した
 * - error: 続けられない失敗（開始できない等。error / errorReason を参照。restart でやり直す）
 */
export type DevicePairingPhase =
  | "idle"
  | "starting"
  | "waiting"
  | "completed"
  | "expired"
  | "canceled"
  | "error";

type State = {
  phase: DevicePairingPhase;
  code: string | null;
  expiresAt: Date | null;
  pollIntervalSeconds: number;
  device: SessionDevice | null;
  error: unknown;
  /** 承認待ちの間に起きた一時的な失敗（確認は続いている） */
  lastError: unknown;
  /** 連続した一時的な失敗の回数（間隔を空けるのに使う） */
  failures: number;
};

const INITIAL_STATE: State = {
  phase: "idle",
  code: null,
  expiresAt: null,
  pollIntervalSeconds: 3,
  device: null,
  error: null,
  lastError: null,
  failures: 0,
};

/** 一時的な失敗の間隔の上限（秒） */
const MAX_BACKOFF_SECONDS = 30;

/** やり直せば通りうる失敗か（429・通信断・5xx） */
const isTransient = (error: unknown): boolean => {
  if (!isHttpError(error)) return true;
  return error.status === undefined || error.status === 429 || error.status >= 500;
};

/** 429 の応答にある resetAt までの秒数（無ければ null） */
const retryAfterSeconds = (error: unknown): number | null => {
  if (!isHttpError(error) || error.status !== 429) return null;
  const data = error.responseData as { resetAt?: unknown } | undefined;
  const resetAt = typeof data?.resetAt === "string" ? Date.parse(data.resetAt) : Number.NaN;
  return Number.isFinite(resetAt) ? Math.max(1, Math.ceil((resetAt - Date.now()) / 1000)) : null;
};

export type UseStartDevicePairingOptions = {
  /** マウント時に自動で開始する（既定 true） */
  autoStart?: boolean;
};

export function useStartDevicePairing(options: UseStartDevicePairingOptions = {}) {
  const { autoStart = true } = options;
  const { mutate } = useSWRConfig();
  const startMutation = useDomainMutation("pairedDevice/start", () => startDevicePairing());
  const pollMutation = useDomainMutation("pairedDevice/poll", () => pollDevicePairing());
  const [state, setState] = useState<State>(INITIAL_STATE);
  // 承認待ちの間、確認するたびに増やして次の確認を予約する
  const [pollTick, setPollTick] = useState(0);
  // やり直し（restart）で古い開始・確認の応答を捨てるための世代番号
  const generationRef = useRef(0);
  const startingRef = useRef(false);

  const { trigger: triggerStart } = startMutation;
  const { trigger: triggerPoll } = pollMutation;

  const start = useCallback(async () => {
    if (startingRef.current) return;
    startingRef.current = true;
    const generation = ++generationRef.current;
    setState({ ...INITIAL_STATE, phase: "starting" });
    try {
      const started = await triggerStart(undefined);
      if (generation !== generationRef.current) return;
      setState({
        ...INITIAL_STATE,
        phase: "waiting",
        code: started.code,
        expiresAt: new Date(started.expiresAt),
        pollIntervalSeconds: started.pollIntervalSeconds,
      });
    } catch (error) {
      if (generation !== generationRef.current) return;
      setState({ ...INITIAL_STATE, phase: "error", error });
    } finally {
      startingRef.current = false;
    }
  }, [triggerStart]);

  const autoStartedRef = useRef(false);
  useEffect(() => {
    if (!autoStart || autoStartedRef.current) return;
    autoStartedRef.current = true;
    void start();
  }, [autoStart, start]);

  const { phase, pollIntervalSeconds, failures, lastError } = state;
  useEffect(() => {
    if (phase !== "waiting") return;
    const generation = generationRef.current;
    const delaySeconds =
      failures === 0
        ? pollIntervalSeconds
        : (retryAfterSeconds(lastError) ??
          Math.min(pollIntervalSeconds * 2 ** failures, MAX_BACKOFF_SECONDS));

    const timer = setTimeout(async () => {
      try {
        const result = await triggerPoll(undefined);
        if (generation !== generationRef.current) return;
        if (result.status === "completed") {
          setState((prev) => ({ ...prev, phase: "completed", device: result.device, lastError: null }));
          await mutate(SESSION_DEVICE_KEY);
          return;
        }
        const { status } = result;
        if (status === "pending") {
          setState((prev) => (prev.failures === 0 ? prev : { ...prev, failures: 0, lastError: null }));
          setPollTick((tick) => tick + 1);
          return;
        }
        setState((prev) => ({ ...prev, phase: status }));
      } catch (error) {
        if (generation !== generationRef.current) return;
        if (isTransient(error)) {
          setState((prev) => ({ ...prev, failures: prev.failures + 1, lastError: error }));
          setPollTick((tick) => tick + 1);
          return;
        }
        // 受け取り済み（used）は、完了の応答が届かなかった場合がある。この端末が登録済みかで判断する
        if (getPairedDeviceErrorReason(error) === "used") {
          const device = await fetchSessionDevice().catch(() => null);
          if (generation !== generationRef.current) return;
          if (device) {
            setState((prev) => ({ ...prev, phase: "completed", device, lastError: null }));
            await mutate(SESSION_DEVICE_KEY);
            return;
          }
        }
        setState((prev) => ({ ...prev, phase: "error", error }));
      }
    }, delaySeconds * 1000);
    return () => clearTimeout(timer);
  }, [phase, pollIntervalSeconds, failures, lastError, pollTick, triggerPoll, mutate]);

  return {
    phase: state.phase,
    /** 画面に表示するコード（表示用に区切った形） */
    code: state.code,
    expiresAt: state.expiresAt,
    /** 登録が完了した端末（phase が completed のとき） */
    device: state.device,
    /** phase が error のときの失敗 */
    error: state.error,
    /** 失敗の理由（rate_limited 等）。画面の文言の切り替えに使う */
    errorReason: getPairedDeviceErrorReason(state.error),
    /** 承認待ちの間の一時的な失敗（確認は続いている。「接続を確認しています」等の表示に使う） */
    lastError: state.lastError,
    /** コードを発行中（ボタンのローディング表示用） */
    isStarting: state.phase === "starting",
    /** 開始する（autoStart: false のとき）。期限切れ・取り消し・エラーの後は新しいコードでやり直す */
    start,
    restart: start,
  };
}
