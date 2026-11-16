"use client";

// src/features/core/messaging/hooks/useDispatchDeleteSummary.ts
//
// 管理: 回の削除の見込み(D88、POST /dispatches/delete-summary)。確認を開いている間(ids があり enabled)だけ取る。
// 一覧のまとめての削除と、回の詳細の 1 件の削除が同じ形で使う

import useSWR from "swr";

import { adminDispatchDeleteSummary, type AdminDeleteSummary } from "../services/client/adminMessagingClient";

import { ADMIN_MESSAGING_KEY } from "./adminMessagingKeys";

export function useDispatchDeleteSummary(ids: readonly string[], enabled: boolean) {
  const key = enabled && ids.length > 0 ? [`${ADMIN_MESSAGING_KEY}/delete-summary`, [...ids].sort().join(",")] : null;
  const { data, error, isLoading } = useSWR<AdminDeleteSummary>(key, () => adminDispatchDeleteSummary(ids), { revalidateOnFocus: false });
  return { summary: data ?? null, error: error ?? null, isLoading };
}
