"use client";

// src/features/core/messaging/hooks/useAdminBulkSend.ts
//
// 管理の一括送信(POST /api/admin/messaging/bulk-send)。成功したら回のキーを再検証する

import { useDomainMutation } from "@/lib/crud/hooks";

import {
  adminBulkSend,
  type AdminBulkSendInput,
  type AdminBulkSendResult,
} from "../services/client/adminMessagingClient";

import { ADMIN_DISPATCHES_KEY, ADMIN_MESSAGING_KEY } from "./adminMessagingKeys";

export function useAdminBulkSend() {
  const mutation = useDomainMutation<AdminBulkSendResult, AdminBulkSendInput>(
    `${ADMIN_MESSAGING_KEY}/bulk-send`,
    (input) => adminBulkSend(input),
    ADMIN_DISPATCHES_KEY,
  );
  return { send: mutation.trigger, isSending: mutation.isMutating, error: mutation.error };
}
