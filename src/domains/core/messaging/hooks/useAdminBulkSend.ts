"use client";

// src/domains/core/messaging/hooks/useAdminBulkSend.ts
//
// 管理の一括送信(POST /api/admin/messaging/bulk-send)。成功したら送信のキーを再検証する。
// useAdminBulkSendOptions = 選択肢(GET、一覧の一括で送れるカテゴリー)。enabled の間だけ取る

import useSWR from "swr";

import { useDomainMutation } from "@/lib/crud";

import {
  adminBulkSend,
  getAdminBulkSendOptions,
  type AdminBulkSendInput,
  type AdminBulkSendOptions,
  type AdminBulkSendResult,
} from "../services/client/adminMessagingClient";
import { ADMIN_BULK_SEND_KEY, ADMIN_BULK_SEND_OPTIONS_KEY, ADMIN_DISPATCHES_KEY } from "./messagingKeys";

export function useAdminBulkSend() {
  const mutation = useDomainMutation<AdminBulkSendResult, AdminBulkSendInput>(
    ADMIN_BULK_SEND_KEY,
    (input) => adminBulkSend(input),
    ADMIN_DISPATCHES_KEY,
  );
  return { send: mutation.trigger, isSending: mutation.isMutating, error: mutation.error };
}

export function useAdminBulkSendOptions(enabled = true) {
  const query = useSWR<AdminBulkSendOptions>(enabled ? ADMIN_BULK_SEND_OPTIONS_KEY : null, () => getAdminBulkSendOptions());
  return { options: query.data ?? null, isLoading: query.isLoading, error: query.error };
}
