// src/features/core/user/hooks/useSearchUserWithProfile.ts
//
// ユーザー + プロフィール横断検索 Hook。
// 指定ロールのプロフィール searchFields も含めてキーワード検索する。

"use client";

import { useSearchDomain } from "@/lib/crud/hooks";
import { userClient } from "../services/client/userClient";
import type { User } from "../entities";
import type { SearchParams, WithOptions } from "@/lib/crud/types";

export type SearchWithProfileParams = SearchParams & WithOptions;

/**
 * ユーザー + プロフィール横断検索 Hook
 *
 * @param role - 検索対象のロール（プロフィールの searchFields を取得するために使用）
 * @param params - 検索パラメータ
 *
 * @example
 * ```tsx
 * const { data, total, isLoading } = useSearchUserWithProfile("contributor", {
 *   searchQuery: "田中",
 *   page: 1,
 *   limit: 20,
 * });
 * ```
 */
export const useSearchUserWithProfile = (
  role: string,
  params: SearchWithProfileParams,
) => {
  return useSearchDomain<User, SearchWithProfileParams>(
    `users/search-with-profile/${role}`,
    (p) => userClient.searchWithProfile(role, p),
    params,
  );
};
