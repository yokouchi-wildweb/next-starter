// src/features/core/admin/services/server/screenData/adminSort.ts
// 管理画面(並び替え)の取得本体。認可と cache は呼び手(ルートの _screen/loader.ts)が持つ。
// service は外から受ける(結ぶのは src/wiring/domains.ts の adminSortParts)。一覧・規則: ./README.md

import "server-only";

import type { PaginatedResult, SearchParams } from "@/lib/crud/types";

/**
 * 並び替えが service に要求する最小の形(sortOrderField を持つドメインの searchForSorting)
 */
export type AdminSortService<T> = {
  searchForSorting(params: SearchParams): Promise<PaginatedResult<T>>;
};

export type AdminSortScreenData<T> = {
  results: T[];
};

/** 並び替え画面が一度に扱う件数 */
const SORT_SCREEN_LIMIT = 100;

/** sortOrderColumn 昇順(NULL は末尾)で先頭 100 件 */
export async function fetchAdminSort<T>(
  service: AdminSortService<T>,
  sortOrderColumn: string,
): Promise<AdminSortScreenData<T>> {
  const { results } = await service.searchForSorting({
    page: 1,
    limit: SORT_SCREEN_LIMIT,
    orderBy: [[sortOrderColumn, "ASC", "LAST"]],
  });
  return { results };
}
