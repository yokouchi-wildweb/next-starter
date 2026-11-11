"use client";

// src/features/core/messaging/hooks/useAdminDispatch.ts
//
// 管理: 回 1 件(SWR)。「続きを送る」(useContinueDispatch)が再検証する

import useSWR from "swr";

import { getAdminDispatch, type AdminDispatchDetail } from "../services/client/adminMessagingClient";

import { adminDispatchKey } from "./adminMessagingKeys";

export function useAdminDispatch(id: string | null | undefined) {
  const { data, error, isLoading, mutate } = useSWR<AdminDispatchDetail>(id ? adminDispatchKey(id) : null, () =>
    getAdminDispatch(id!),
  );
  return { dispatch: data ?? null, error, isLoading, revalidate: () => mutate() };
}
