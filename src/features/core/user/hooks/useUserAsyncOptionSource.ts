// src/features/core/user/hooks/useUserAsyncOptionSource.ts

"use client";

import { type ReactNode, useMemo } from "react";
import useSWR from "swr";

import type { Options } from "@/components/Form/types";
import type { PaginatedResult, SearchParams, WhereExpr } from "@/lib/crud/types";
import type { User } from "@/features/core/user/entities";
import type { UserRoleType } from "@/features/core/user/types";
import { userClient } from "@/features/core/user/services/client/userClient";
import { getUserOption, mergeUserWhere } from "@/features/core/user/utils/userOption";

export type UseUserAsyncOptionSourceOptions = {
  /** ロールでフィルタリング */
  role?: UserRoleType | UserRoleType[];
  /** 追加の検索条件 */
  where?: WhereExpr;
  /** ラベルのカスタムフォーマット */
  formatLabel?: (user: User) => ReactNode;
  /** 編集時の既存値 ID(ラベルを解決して initialOptions に返す) */
  initialIds?: string[];
};

export type UserAsyncOptionSource = {
  /** AsyncComboboxInput / AsyncMultiSelectInput の searchFn(role/where を検索条件にマージ済み) */
  searchFn: (params: SearchParams) => Promise<PaginatedResult<User>>;
  /** User → Options 変換(formatLabel 適用) */
  getOptionFromResult: (user: User) => Options;
  /** initialIds のラベル解決結果。未指定・解決中は undefined */
  initialOptions: Options[] | undefined;
};

/**
 * ユーザー選択 UI(UserAsyncCombobox / UserAsyncMultiSelect)のデータ源。
 * 非同期検索の関数と、編集時の既存値ラベルの解決(SWR)をまとめて返す。
 * 独自のユーザー選択 UI を作るときもこのフックを使う。
 */
export function useUserAsyncOptionSource({
  role,
  where,
  formatLabel,
  initialIds,
}: UseUserAsyncOptionSourceOptions): UserAsyncOptionSource {
  const searchFn = useMemo(
    () => {
      const mergedWhere = mergeUserWhere(role, where);
      return (params: SearchParams) => {
        const finalWhere = (() => {
          if (!mergedWhere && !params.where) return undefined;
          if (!mergedWhere) return params.where;
          if (!params.where) return mergedWhere;
          return { and: [mergedWhere, params.where] };
        })();

        return userClient.search!({
          ...params,
          where: finalWhere,
        });
      };
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [role, JSON.stringify(where)],
  );

  const getOptionFromResult = useMemo(
    () => (user: User) => getUserOption(user, formatLabel),
    [formatLabel],
  );

  const ids = initialIds && initialIds.length > 0 ? initialIds : null;
  const { data: initialOptions } = useSWR(
    ids ? ["userAsyncOptionSource:initial", ids.join(",")] : null,
    async () => {
      const { results } = await userClient.search!({
        where: { field: "id", op: "in", value: ids },
        limit: ids!.length,
      });
      return results.map((user) => getUserOption(user, formatLabel));
    },
    { revalidateOnFocus: false, revalidateOnReconnect: false },
  );

  return { searchFn, getOptionFromResult, initialOptions };
}
