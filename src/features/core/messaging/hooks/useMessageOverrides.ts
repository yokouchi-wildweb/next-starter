"use client";

// src/features/core/messaging/hooks/useMessageOverrides.ts
//
// 管理: 編集できる連絡の一覧(SWR。adminEditable を宣言した定義だけなので全部を 1 回で取る)

import useSWR from "swr";

import { listMessageOverrides, type AdminOverrideMessageSummary } from "../services/client/overrideClient";

import { MESSAGE_OVERRIDES_KEY } from "./overrideKeys";

export function useMessageOverrides() {
  const { data, error, isLoading, mutate } = useSWR<AdminOverrideMessageSummary[]>(MESSAGE_OVERRIDES_KEY, () =>
    listMessageOverrides(),
  );
  return { items: data ?? [], error, isLoading, revalidate: () => mutate() };
}
