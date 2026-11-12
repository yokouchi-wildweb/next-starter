"use client";

// src/features/core/messaging/hooks/useRetractDispatch.ts
//
// 管理: 回の取り下げ(戻せない)。成功したらその回と回の一覧を再検証する(配達の一覧は呼び手が revalidate する)

import { useDomainMutation } from "@/lib/crud/hooks";

import { retractAdminDispatch, type AdminRetractResult } from "../services/client/adminMessagingClient";

import { ADMIN_DISPATCHES_KEY, adminDispatchKey } from "./adminMessagingKeys";

export function useRetractDispatch(dispatchId: string) {
  const mutation = useDomainMutation<AdminRetractResult, void>(
    `${adminDispatchKey(dispatchId)}/retract`,
    () => retractAdminDispatch(dispatchId),
    [adminDispatchKey(dispatchId), ADMIN_DISPATCHES_KEY],
  );
  return { trigger: mutation.trigger, isMutating: mutation.isMutating, error: mutation.error };
}
