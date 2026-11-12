"use client";

// src/features/core/messaging/hooks/useAdminSendOptions.ts
//
// 管理: 送る画面の選択肢(SWR。経路・ロール・宛先の集め方・公開中のテンプレート・予約できる日数)

import useSWR from "swr";

import { getAdminSendOptions, type AdminSendOptions } from "../services/client/sendClient";

import { ADMIN_SEND_OPTIONS_KEY } from "./sendKeys";

export function useAdminSendOptions() {
  const { data, error, isLoading } = useSWR<AdminSendOptions>(ADMIN_SEND_OPTIONS_KEY, () => getAdminSendOptions());
  return { options: data ?? null, error, isLoading };
}
