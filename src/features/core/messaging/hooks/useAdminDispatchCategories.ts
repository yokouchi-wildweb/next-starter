"use client";

// src/features/core/messaging/hooks/useAdminDispatchCategories.ts
//
// 管理: 回の画面の絞りの選択肢 = カテゴリー(受け口の全部、fork の物も)の鍵・表示名・種別(SWR、GET /api/admin/messaging/dispatches/categories)。
// - optionsOf(kind) = その種別のカテゴリーを表示名で(回の一覧の「カテゴリー」の選び。種別を選ぶまでは空)
// - labelOf(key) = 表示名(回の詳細・行。鍵は見せない、D46。受け口から消えたカテゴリー・取れる前は null)

import { useCallback } from "react";
import useSWR from "swr";

import { getAdminDispatchCategories, type AdminDispatchCategoryOption } from "../services/client/adminMessagingClient";

import { ADMIN_DISPATCH_CATEGORIES_KEY } from "./adminMessagingKeys";

export function useAdminDispatchCategories() {
  const { data, error, isLoading } = useSWR<AdminDispatchCategoryOption[]>(ADMIN_DISPATCH_CATEGORIES_KEY, () => getAdminDispatchCategories());
  const categories = data ?? null;
  const optionsOf = useCallback(
    (kind: string) => (kind ? (categories ?? []).filter((c) => c.kind === kind).map((c) => ({ value: c.key, label: c.label })) : []),
    [categories],
  );
  const labelOf = useCallback(
    (key: string | null | undefined) => (key ? ((categories ?? []).find((c) => c.key === key)?.label ?? null) : null),
    [categories],
  );
  return { categories: categories ?? [], loaded: categories !== null, error, isLoading, optionsOf, labelOf };
}
