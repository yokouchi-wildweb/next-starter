"use client";

// src/features/core/pairedDevice/hooks/usePairedDevice.ts

import useSWR, { type SWRConfiguration } from "swr";

import {
  fetchPairedDevice,
  type PairedDeviceDetailResponse,
} from "@/features/core/pairedDevice/services/client/pairedDeviceManageClient";

import { PAIRED_DEVICES_DETAIL_KEY } from "./keys";

/** 端末の詳細と、未使用のペアリングコード。id が null の間は取得しない */
export function usePairedDevice(
  id: string | null,
  config?: SWRConfiguration<PairedDeviceDetailResponse>,
) {
  return useSWR<PairedDeviceDetailResponse>(
    id ? ([PAIRED_DEVICES_DETAIL_KEY, id] as const) : null,
    () => fetchPairedDevice(id as string),
    config,
  );
}
