"use client";

// src/features/core/user/components/common/UserAsyncMultiSelect.tsx

import { type ReactNode, useMemo } from "react";
import useSWR from "swr";

import {
  AsyncMultiSelectInput,
  type AsyncMultiSelectInputProps,
} from "@/components/Form/Input/Manual/AsyncMultiSelectInput";
import type { User } from "@/features/core/user/entities";
import type { UserRoleType } from "@/features/core/user/types";
import type { WhereExpr } from "@/lib/crud/types";

import {
  createUserSearchFn,
  getUserOption,
  DEFAULT_USER_SEARCH_FIELDS,
} from "./userSelectUtils";
import { userClient } from "@/features/core/user/services/client/userClient";

type OmittedProps =
  | "searchFn"
  | "getOptionFromResult"
  | "searchFields"
  | "initialOptions";

export type UserAsyncMultiSelectProps = Omit<
  AsyncMultiSelectInputProps<User>,
  OmittedProps
> & {
  /** ロールでフィルタリング */
  role?: UserRoleType | UserRoleType[];
  /** 追加の検索条件 */
  where?: WhereExpr;
  /** ラベルのカスタムフォーマット */
  formatLabel?: (user: User) => ReactNode;
  /** 検索対象フィールド（デフォルト: ["name", "email"]） */
  searchFields?: string[];
  /** 編集時の既存値ID配列（内部でSWR解決） */
  initialIds?: string[];
};

export function UserAsyncMultiSelect({
  role,
  where,
  formatLabel,
  searchFields = DEFAULT_USER_SEARCH_FIELDS,
  initialIds,
  ...rest
}: UserAsyncMultiSelectProps) {
  const searchFn = useMemo(
    () => createUserSearchFn(role, where),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [role, JSON.stringify(where)],
  );

  const getOptionFromResult = useMemo(
    () => (user: User) => getUserOption(user, formatLabel),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [formatLabel],
  );

  // 編集時: 既存ID配列のラベルを解決
  const { data: initialOptions } = useSWR(
    initialIds && initialIds.length > 0
      ? ["userAsyncMultiSelect:initial", initialIds.join(",")]
      : null,
    async () => {
      const { results } = await userClient.search!({
        where: { field: "id", op: "in", value: initialIds },
        limit: initialIds!.length,
      });
      return results.map((user) => getUserOption(user, formatLabel));
    },
    { revalidateOnFocus: false, revalidateOnReconnect: false },
  );

  return (
    <AsyncMultiSelectInput<User>
      searchFn={searchFn}
      getOptionFromResult={getOptionFromResult}
      searchFields={searchFields}
      initialOptions={initialOptions ?? []}
      placeholder="ユーザーを検索して選択"
      searchPlaceholder="名前またはメールで検索（Enter）"
      emptyMessage="該当するユーザーがいません"
      {...rest}
    />
  );
}
