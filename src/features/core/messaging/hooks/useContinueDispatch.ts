"use client";

// src/features/core/messaging/hooks/useContinueDispatch.ts
//
// 管理: 回を 1 束だけ進める(続きを送る)。成功したらその回を再検証する(配達の一覧は呼び手が revalidate する)

import { useDomainMutation } from "@/lib/crud/hooks";

import { continueAdminDispatch, type ContinueSendingResult } from "../services/client/adminMessagingClient";

import { ADMIN_DISPATCHES_KEY, adminDispatchKey } from "./adminMessagingKeys";

export function useContinueDispatch(dispatchId: string) {
  const mutation = useDomainMutation<ContinueSendingResult, void>(
    `${adminDispatchKey(dispatchId)}/continue`,
    () => continueAdminDispatch(dispatchId),
    [adminDispatchKey(dispatchId), ADMIN_DISPATCHES_KEY],
  );
  return { continueSending: mutation.trigger, isContinuing: mutation.isMutating, error: mutation.error };
}
