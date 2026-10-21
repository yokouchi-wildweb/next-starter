"use client";

// src/features/core/pairedDevice/hooks/useClaimDevicePairing.ts
//
// 管理者が発行したコードを送り、この端末を登録する mutation フック（POST /api/paired-device/pairing/claim）。
// 成功すると端末トークンが httpOnly Cookie に入り、useSessionDevice が再検証される。

import { useEffect, useRef } from "react";

import type { SessionDevice } from "@/features/core/pairedDevice/entities/model";
import { claimPairingCode } from "@/features/core/pairedDevice/services/client/pairedDeviceClient";
import { getPairedDeviceErrorReason } from "@/features/core/pairedDevice/utils/errorReason";
import { useDomainMutation } from "@/lib/crud/hooks";

import { SESSION_DEVICE_KEY } from "./keys";

export type UseClaimDevicePairingOptions = {
  /**
   * 指定すると、そのコードで 1 回だけ自動送信する（QR から開いたとき）。
   * useDevicePairingCodeFromUrl() の戻り値をそのまま渡す想定
   */
  autoClaimCode?: string | null;
};

export function useClaimDevicePairing(options: UseClaimDevicePairingOptions = {}) {
  const mutation = useDomainMutation<SessionDevice, string>(
    "pairedDevice/claim",
    (code) => claimPairingCode(code),
    SESSION_DEVICE_KEY,
  );

  const { trigger } = mutation;
  const autoClaimedRef = useRef<string | null>(null);
  const { autoClaimCode } = options;
  useEffect(() => {
    if (!autoClaimCode || autoClaimedRef.current === autoClaimCode) return;
    autoClaimedRef.current = autoClaimCode;
    // 結果は mutation の状態（data / error / errorReason）で受け取る
    trigger(autoClaimCode).catch(() => undefined);
  }, [autoClaimCode, trigger]);

  return {
    ...mutation,
    /** 失敗の理由（not_found / expired / used / rate_limited 等）。画面の文言の切り替えに使う */
    errorReason: getPairedDeviceErrorReason(mutation.error),
  };
}
