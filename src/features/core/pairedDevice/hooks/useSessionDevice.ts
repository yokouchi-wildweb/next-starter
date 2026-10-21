"use client";

// src/features/core/pairedDevice/hooks/useSessionDevice.ts

import useSWR, { type SWRConfiguration } from "swr";

import type { SessionDevice } from "@/features/core/pairedDevice/entities/model";
import { fetchSessionDevice } from "@/features/core/pairedDevice/services/client/pairedDeviceClient";

import { SESSION_DEVICE_KEY } from "./keys";

/**
 * この端末が登録済みかを返す。data は登録済みなら端末の情報、未登録なら null。
 * ペアリング画面で「登録済みなら画面を飛ばす」分岐や、端末画面での表示に使う。
 * 初回描画のデータを loader（getSessionDevice）から渡すときは fallbackData に入れる。
 */
export function useSessionDevice(config?: SWRConfiguration<SessionDevice | null>) {
  return useSWR<SessionDevice | null>(SESSION_DEVICE_KEY, fetchSessionDevice, config);
}
