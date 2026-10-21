"use client";

// src/features/core/pairedDevice/hooks/useStartDevicePairing.ts
//
// 端末側から始めるペアリング（端末がコード / QR を表示し、管理者が自分の端末で承認する）。
// 開始 → 承認の確認（ポーリング）→ 登録完了までを 1 つのフックにまとめる。
// 画面は phase で表示を切り替え、code（と承認ページの URL を入れた QR）を出すだけでよい。

import { useCallback, useEffect, useRef, useState } from "react";
import { useSWRConfig } from "swr";

import type { SessionDevice } from "@/features/core/pairedDevice/entities/model";
import {
  pollDevicePairing,
  startDevicePairing,
} from "@/features/core/pairedDevice/services/client/pairedDeviceClient";
import { getPairedDeviceErrorReason } from "@/features/core/pairedDevice/utils/errorReason";
import { useDomainMutation } from "@/lib/crud/hooks";

import { SESSION_DEVICE_KEY } from "./keys";

/**
 * - idle: 未開始（autoStart: false のとき）
 * - starting: コードを発行中
 * - waiting: コードを表示して承認待ち（ポーリング中）
 * - completed: 承認されてこの端末が登録された（device に端末の情報）
 * - expired: コードの有効期限切れ（restart で新しいコードを出す）
 * - canceled: 管理者が取り消した
 * - error: 通信エラー等（error / errorReason を参照。restart でやり直す）
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
};

const INITIAL_STATE: State = {
  phase: "idle",
  code: null,
  expiresAt: null,
  pollIntervalSeconds: 3,
  device: null,
  error: null,
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

  const { trigger: triggerStart } = startMutation;
  const { trigger: triggerPoll } = pollMutation;

  const start = useCallback(async () => {
    setState({ ...INITIAL_STATE, phase: "starting" });
    try {
      const started = await triggerStart(undefined);
      setState({
        ...INITIAL_STATE,
        phase: "waiting",
        code: started.code,
        expiresAt: new Date(started.expiresAt),
        pollIntervalSeconds: started.pollIntervalSeconds,
      });
    } catch (error) {
      setState({ ...INITIAL_STATE, phase: "error", error });
    }
  }, [triggerStart]);

  const autoStartedRef = useRef(false);
  useEffect(() => {
    if (!autoStart || autoStartedRef.current) return;
    autoStartedRef.current = true;
    void start();
  }, [autoStart, start]);

  const { phase, expiresAt, pollIntervalSeconds } = state;
  useEffect(() => {
    if (phase !== "waiting") return;
    const timer = setTimeout(async () => {
      if (expiresAt && expiresAt.getTime() <= Date.now()) {
        setState((prev) => ({ ...prev, phase: "expired" }));
        return;
      }
      try {
        const result = await triggerPoll(undefined);
        if (result.status === "completed") {
          setState((prev) => ({ ...prev, phase: "completed", device: result.device }));
          await mutate(SESSION_DEVICE_KEY);
          return;
        }
        const { status } = result;
        if (status === "pending") {
          setPollTick((tick) => tick + 1);
          return;
        }
        setState((prev) => ({ ...prev, phase: status }));
      } catch (error) {
        setState((prev) => ({ ...prev, phase: "error", error }));
      }
    }, pollIntervalSeconds * 1000);
    return () => clearTimeout(timer);
  }, [phase, expiresAt, pollIntervalSeconds, pollTick, triggerPoll, mutate]);

  return {
    phase: state.phase,
    /** 画面に表示するコード（表示用に区切った形） */
    code: state.code,
    expiresAt: state.expiresAt,
    /** 登録が完了した端末（phase が completed のとき） */
    device: state.device,
    error: state.error,
    /** 失敗の理由（rate_limited 等）。画面の文言の切り替えに使う */
    errorReason: getPairedDeviceErrorReason(state.error),
    /** コードを発行中（ボタンのローディング表示用） */
    isStarting: state.phase === "starting",
    /** 開始する（autoStart: false のとき）。期限切れ・エラーの後は新しいコードでやり直す */
    start,
    restart: start,
  };
}
