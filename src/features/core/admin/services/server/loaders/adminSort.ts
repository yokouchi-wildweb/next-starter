// src/features/core/admin/services/server/loaders/adminSort.ts
// dc:generate が生成する管理画面(並び替え)の共有 loader。一覧・規則: ./README.md

import "server-only";
import { cache } from "react";

import type { PaginatedResult, SearchParams } from "@/lib/crud/types";

/**
 * 並び替え loader が service に要求する最小の形(sortOrderField を持つドメインの searchForSorting)。
 * 必須にしてあるので、searchForSorting を持たない service を渡すとコンパイル時に分かる
 */
export type AdminSortService<T> = {
  searchForSorting(params: SearchParams): Promise<PaginatedResult<T>>;
};

export type AdminSortScreenData<T> = {
  results: T[];
};

/** 並び替え画面が一度に扱う件数(従来の page.tsx と同じ) */
const SORT_SCREEN_LIMIT = 100;

const resolveAdminSortScreen = cache(
  async <T,>(service: AdminSortService<T>, sortOrderColumn: string): Promise<AdminSortScreenData<T>> => {
    const { results } = await service.searchForSorting({
      page: 1,
      limit: SORT_SCREEN_LIMIT,
      orderBy: [[sortOrderColumn, "ASC", "LAST"]],
    });
    return { results };
  },
);

/**
 * 生成された管理画面(並び替え)のデータ。sortOrderColumn 昇順(NULL は末尾)で先頭 100 件。
 * 生成コードは domain.json の sortOrderField を渡す(既定 "sort_order")。
 * 認可は admin/(protected)/layout.tsx の authGuard が担うため、ここでは行わない。
 */
export async function loadAdminSortScreen<T>(
  service: AdminSortService<T>,
  sortOrderColumn = "sort_order",
): Promise<AdminSortScreenData<T>> {
  return resolveAdminSortScreen(service, sortOrderColumn);
}
