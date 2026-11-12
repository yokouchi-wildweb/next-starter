"use client";

// src/features/core/messaging/hooks/useCancelDispatch.ts
//
// 管理: 回の予約の取り消し(予約でまだ展開していない回だけ)。成功したらその回と回の一覧を再検証する(配達の一覧は呼び手が revalidate する)

import { useDomainMutation } from "@/lib/crud/hooks";

import { cancelAdminDispatch, type AdminCancelResult } from "../services/client/adminMessagingClient";

import { ADMIN_DISPATCHES_KEY, adminDispatchKey } from "./adminMessagingKeys";

export function useCancelDispatch(dispatchId: string) {
  const mutation = useDomainMutation<AdminCancelResult, void>(
    `${adminDispatchKey(dispatchId)}/cancel`,
    () => cancelAdminDispatch(dispatchId),
    [adminDispatchKey(dispatchId), ADMIN_DISPATCHES_KEY],
  );
  return { trigger: mutation.trigger, isMutating: mutation.isMutating, error: mutation.error };
}
