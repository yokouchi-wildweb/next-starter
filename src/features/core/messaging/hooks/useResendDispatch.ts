"use client";

// src/features/core/messaging/hooks/useResendDispatch.ts
//
// 管理: 回の失敗の再送({ includeUnknown } = 送れたか分からない宛先も含める)。成功したらその回と回の一覧を再検証する
// (新しい回として送った時は結果の newDispatchId がその回)

import { useDomainMutation } from "@/lib/crud/hooks";

import { resendAdminDispatch, type AdminResendResult } from "../services/client/adminMessagingClient";

import { ADMIN_DISPATCHES_KEY, adminDispatchKey } from "./adminMessagingKeys";

export function useResendDispatch(dispatchId: string) {
  const mutation = useDomainMutation<AdminResendResult, { includeUnknown?: boolean }>(
    `${adminDispatchKey(dispatchId)}/resend`,
    (input) => resendAdminDispatch(dispatchId, input),
    [adminDispatchKey(dispatchId), ADMIN_DISPATCHES_KEY],
  );
  return { trigger: mutation.trigger, isMutating: mutation.isMutating, error: mutation.error };
}
