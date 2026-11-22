"use client";

// src/domains/core/messaging/hooks/useResendDispatch.ts
//
// 管理: 送信の失敗の再送({ includeUnknown } = 送れたか分からない宛先も含める)。成功したらその送信と送信の一覧を再検証する
// (新しい送信になった時は結果の newDispatchId がその送信)

import { useDomainMutation } from "@/lib/crud";

import { resendAdminDispatch, type AdminResendResult } from "../services/client/adminMessagingClient";
import { ADMIN_DISPATCHES_KEY, adminDispatchKey, adminDispatchResendKey } from "./messagingKeys";

export function useResendDispatch(dispatchId: string) {
  const mutation = useDomainMutation<AdminResendResult, { includeUnknown?: boolean }>(
    adminDispatchResendKey(dispatchId),
    (input) => resendAdminDispatch(dispatchId, input),
    [adminDispatchKey(dispatchId), ADMIN_DISPATCHES_KEY],
  );
  return { trigger: mutation.trigger, isMutating: mutation.isMutating, error: mutation.error };
}
