"use client";

// src/features/core/messaging/hooks/useAdminSendOptions.ts
//
// 管理: 送る画面の選択肢(SWR。経路・ロール・宛先の集め方・公開中のテンプレート・予約できる日数)。enabled の間だけ取る(送るモーダルが開いている間)

import useSWR from "swr";

import { getAdminSendOptions, type AdminSendOptions } from "../services/client/sendClient";

import { ADMIN_SEND_OPTIONS_KEY } from "./sendKeys";

export function useAdminSendOptions(enabled = true) {
  const { data, error, isLoading } = useSWR<AdminSendOptions>(enabled ? ADMIN_SEND_OPTIONS_KEY : null, () => getAdminSendOptions());
  return { options: data ?? null, error, isLoading };
}
