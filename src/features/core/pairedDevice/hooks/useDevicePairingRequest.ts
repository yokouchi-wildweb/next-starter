"use client";

// src/features/core/pairedDevice/hooks/useDevicePairingRequest.ts

import useSWR, { type SWRConfiguration } from "swr";

import type { DevicePairingRequestForApprover } from "@/features/core/pairedDevice/entities/model";
import { fetchDevicePairingRequest } from "@/features/core/pairedDevice/services/client/pairedDeviceManageClient";

import { DEVICE_PAIRING_REQUEST_KEY } from "./keys";

/**
 * 端末から始めたペアリングの情報（承認画面で、どの端末かを確かめる材料: User-Agent・IP・期限）。
 * code が null の間は取得しない。承認は useApproveDevicePairing。
 */
export function useDevicePairingRequest(
  code: string | null,
  config?: SWRConfiguration<DevicePairingRequestForApprover>,
) {
  return useSWR<DevicePairingRequestForApprover>(
    code ? ([DEVICE_PAIRING_REQUEST_KEY, code] as const) : null,
    () => fetchDevicePairingRequest(code as string),
    { shouldRetryOnError: false, ...config },
  );
}
