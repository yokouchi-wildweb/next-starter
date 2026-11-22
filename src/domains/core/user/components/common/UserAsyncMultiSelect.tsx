"use client";

// src/domains/core/user/components/common/UserAsyncMultiSelect.tsx

import type { ReactNode } from "react";

import {
  AsyncMultiSelectInput,
  type AsyncMultiSelectInputProps,
} from "@/components/Input/AsyncMultiSelectInput";
import type { User } from "@/domains/core/user/entities";
import type { UserRoleType } from "@/domains/core/user/types";
import type { WhereExpr } from "@/lib/crud";

import { useUserAsyncOptionSource } from "@/domains/core/user/hooks/useUserAsyncOptionSource";
import { DEFAULT_USER_SEARCH_FIELDS } from "@/domains/core/user/utils/userOption";

type OmittedProps =
  | "searchFn"
  | "getOptionFromResult"
  | "searchFields"
  | "initialOptions"
  // 基底 HTMLAttributes の role(AriaRole) を遮断（ロールフィルタの role と衝突し配列形が型エラーになるため）
  | "role";

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
  const { searchFn, getOptionFromResult, initialOptions } = useUserAsyncOptionSource({
    role,
    where,
    formatLabel,
    initialIds,
  });

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
