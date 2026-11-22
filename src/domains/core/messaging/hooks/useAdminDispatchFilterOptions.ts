"use client";

// src/domains/core/messaging/hooks/useAdminDispatchFilterOptions.ts
//
// 管理: 送信の一覧の絞りの選択肢 = 送り元・送った人(SWR、GET /api/admin/messaging/dispatches/filters。どちらも新しく送った順に 200 件まで)。
// - sourceOptions = 送り元を表示名で(鍵は見せない、D46。表示名の無い送り元は「(名前のない送り元)」)
// - actorOptions = 運営として送った人を名前で(利用者の id は見せない。名前の無い人は「(名前未設定のユーザー)」)

import { useMemo } from "react";
import useSWR from "swr";

import { getAdminDispatchFilters, type AdminDispatchFilterOptions } from "../services/client/adminMessagingClient";
import { ADMIN_DISPATCH_FILTER_OPTIONS_KEY } from "./messagingKeys";

export type AdminDispatchFilterOption = { value: string; label: string };

/** 表示名の無い送り元の表示 */
export const UNNAMED_SOURCE_LABEL = "(名前のない送り元)";
/** 名前の無い送った人の表示 */
export const UNNAMED_ACTOR_LABEL = "(名前未設定のユーザー)";

/** 選択肢の口の応答 → 選びの選択肢(鍵・id は value にだけ置く) */
export function dispatchFilterOptionsOf(data: AdminDispatchFilterOptions | null | undefined): {
  sourceOptions: AdminDispatchFilterOption[];
  actorOptions: AdminDispatchFilterOption[];
} {
  return {
    sourceOptions: (data?.sources ?? []).map((source) => ({ value: source.key, label: source.label ?? UNNAMED_SOURCE_LABEL })),
    actorOptions: (data?.actors ?? []).map((actor) => ({ value: actor.id, label: actor.name ?? UNNAMED_ACTOR_LABEL })),
  };
}

export function useAdminDispatchFilterOptions() {
  const { data, error, isLoading } = useSWR<AdminDispatchFilterOptions>(ADMIN_DISPATCH_FILTER_OPTIONS_KEY, () => getAdminDispatchFilters());
  const options = useMemo(() => dispatchFilterOptionsOf(data), [data]);
  return { ...options, loaded: data !== undefined, error, isLoading };
}
