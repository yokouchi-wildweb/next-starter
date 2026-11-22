"use client";

// src/domains/core/messaging/hooks/useDeleteDispatch.ts
//
// 管理: 送信の削除(D88、どの状態でも・戻せない)。成功したらその送信と送信の一覧を再検証する(配達の一覧は呼び手が revalidate する)

import { useDomainMutation } from "@/lib/crud";

import { deleteAdminDispatch, type AdminDeleteResult } from "../services/client/adminMessagingClient";
import { ADMIN_DISPATCHES_KEY, adminDispatchDeleteKey, adminDispatchKey } from "./messagingKeys";

export function useDeleteDispatch(dispatchId: string) {
  const mutation = useDomainMutation<AdminDeleteResult, void>(
    adminDispatchDeleteKey(dispatchId),
    () => deleteAdminDispatch(dispatchId),
    [adminDispatchKey(dispatchId), ADMIN_DISPATCHES_KEY],
  );
  return { trigger: mutation.trigger, isMutating: mutation.isMutating, error: mutation.error };
}
