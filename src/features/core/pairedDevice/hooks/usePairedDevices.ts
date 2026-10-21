"use client";

// src/features/core/pairedDevice/hooks/usePairedDevices.ts

import useSWR, { type SWRConfiguration } from "swr";

import type { ListPairedDevicesInput } from "@/features/core/pairedDevice/entities/schema";
import {
  listPairedDevices,
  type ListPairedDevicesResponse,
} from "@/features/core/pairedDevice/services/client/pairedDeviceManageClient";

import { PAIRED_DEVICES_LIST_KEY } from "./keys";

/**
 * 管理できる端末の一覧（ページング付き）。kind / scope（部分一致）/ includeRevoked で絞り込める。
 * 端末の状態（state）とオンライン判定（online）はサーバーが付ける。
 * オンライン表示を最新に保ちたい画面は config に refreshInterval を渡す。
 */
export function usePairedDevices(
  params: ListPairedDevicesInput = {},
  config?: SWRConfiguration<ListPairedDevicesResponse>,
) {
  return useSWR<ListPairedDevicesResponse>(
    [PAIRED_DEVICES_LIST_KEY, params] as const,
    () => listPairedDevices(params),
    config,
  );
}
