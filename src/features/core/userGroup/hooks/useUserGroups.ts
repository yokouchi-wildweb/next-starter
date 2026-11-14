"use client";

// src/features/core/userGroup/hooks/useUserGroups.ts
//
// 管理: ユーザーグループの一覧(無限スクロール、カーソルのモード)。種類・状態が変われば先頭から取り直す

import { useInfiniteScrollQuery } from "@/hooks/useInfiniteScrollQuery";

import { listUserGroups, type AdminUserGroupSummary } from "../services/client/userGroupAdminClient";

const DEFAULT_LIMIT = 20;

export type UseUserGroupsOptions = {
  /** dynamic | scheduled | static(省略 = 全部) */
  kind?: string;
  /** active(既定)| archived */
  status?: string;
  /** 1 回の件数(既定 20、最大 50。人数を数えるので小さめ) */
  limit?: number;
  enabled?: boolean;
  observerOptions?: IntersectionObserverInit;
};

export function useUserGroups(options: UseUserGroupsOptions = {}) {
  const { kind, status, limit = DEFAULT_LIMIT, enabled, observerOptions } = options;
  return useInfiniteScrollQuery<AdminUserGroupSummary, Record<string, never>>({
    cursorFetcher: ({ cursor, limit: pageLimit }) => listUserGroups({ kind, status, cursor, limit: pageLimit }),
    limit,
    enabled,
    observerOptions,
    deps: [kind, status, limit],
  });
}
