"use client";

// src/features/core/messaging/hooks/useMessageOverride.ts
//
// 管理: 1 連絡の全欄(SWR)。保存・既定に戻す(useMessageOverrideEditor)が再検証する

import useSWR from "swr";

import { getMessageOverride, type AdminOverrideMessageDetail } from "../services/client/overrideClient";

import { messageOverrideKey } from "./overrideKeys";

export function useMessageOverride(key: string | null | undefined) {
  const { data, error, isLoading, mutate } = useSWR<AdminOverrideMessageDetail>(key ? messageOverrideKey(key) : null, () =>
    getMessageOverride(key!),
  );
  return { detail: data ?? null, error, isLoading, revalidate: () => mutate() };
}
