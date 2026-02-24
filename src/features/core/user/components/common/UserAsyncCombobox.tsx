"use client";

// src/features/core/user/components/common/UserAsyncCombobox.tsx

import { type ReactNode, useMemo } from "react";
import useSWR from "swr";

import {
  AsyncComboboxInput,
  type AsyncComboboxInputProps,
} from "@/components/Form/Input/Manual/AsyncComboboxInput";
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
  | "initialOption";

export type UserAsyncComboboxProps = Omit<
  AsyncComboboxInputProps<User>,
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
  /** 編集時の既存値ID（内部でSWR解決） */
  initialId?: string;
};

export function UserAsyncCombobox({
  role,
  where,
  formatLabel,
  searchFields = DEFAULT_USER_SEARCH_FIELDS,
  initialId,
  ...rest
}: UserAsyncComboboxProps) {
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

  // 編集時: 既存IDのラベルを解決
  const { data: initialOption } = useSWR(
    initialId ? ["userAsyncCombobox:initial", initialId] : null,
    async () => {
      const { results } = await userClient.search!({
        where: { field: "id", op: "eq", value: initialId },
        limit: 1,
      });
      if (results.length === 0) return undefined;
      return getUserOption(results[0], formatLabel);
    },
    { revalidateOnFocus: false, revalidateOnReconnect: false },
  );

  return (
    <AsyncComboboxInput<User>
      searchFn={searchFn}
      getOptionFromResult={getOptionFromResult}
      searchFields={searchFields}
      initialOption={initialOption}
      placeholder="ユーザーを検索して選択"
      searchPlaceholder="名前またはメールで検索（Enter）"
      emptyMessage="該当するユーザーがいません"
      {...rest}
    />
  );
}
