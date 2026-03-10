// src/features/core/user/hooks/useSearchUserWithProfile.ts
//
// ユーザー + プロフィール横断検索 Hook。
// 指定ロールのプロフィール searchFields も含めてキーワード検索する。
// profileWhere でプロフィールフィールドの構造化フィルタも可能。

"use client";

import { useSearchDomain } from "@/lib/crud/hooks";
import { userClient } from "../services/client/userClient";
import type { SearchWithProfileClientParams } from "../services/client/userClient";
import type { User } from "../entities";

/**
 * ユーザー + プロフィール横断検索 Hook
 *
 * @param role - 検索対象のロール（プロフィールの searchFields を取得するために使用）
 * @param params - 検索パラメータ
 *
 * @example
 * ```tsx
 * // テキスト横断検索
 * const { data, total, isLoading } = useSearchUserWithProfile("contributor", {
 *   searchQuery: "田中",
 *   page: 1,
 *   limit: 20,
 * });
 *
 * // プロフィールフィールドでフィルタ
 * const { data } = useSearchUserWithProfile("contributor", {
 *   profileWhere: { field: "prefecture", op: "eq", value: "東京都" },
 *   page: 1,
 *   limit: 20,
 * });
 *
 * // 両方組み合わせ
 * const { data } = useSearchUserWithProfile("contributor", {
 *   searchQuery: "田中",
 *   profileWhere: {
 *     and: [
 *       { field: "prefecture", op: "eq", value: "東京都" },
 *       { field: "age", op: "gte", value: 20 },
 *     ],
 *   },
 *   page: 1,
 *   limit: 20,
 * });
 * ```
 */
export const useSearchUserWithProfile = (
  role: string,
  params: SearchWithProfileClientParams,
) => {
  return useSearchDomain<User, SearchWithProfileClientParams>(
    `users/search-with-profile/${role}`,
    (p) => userClient.searchWithProfile(role, p),
    params,
  );
};
