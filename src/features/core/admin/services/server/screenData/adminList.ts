// src/features/core/admin/services/server/screenData/adminList.ts
// 管理画面(一覧)の取得本体。認可と cache は呼び手(ルートの _screen/loader.ts = guard.ts の createLoader)が持つ。
// service は外から受ける(登録表は読まない。結ぶのは src/wiring/adminScreenParts.ts の adminListParts)。一覧・規則: ./README.md

import "server-only";

import type { PaginatedResult, SearchParams, WithOptions } from "@/lib/crud/types";
import { settingService } from "@/features/core/setting/services/server/settingService";

/** 一覧が service に要求する最小の形(createCrudService の search) */
export type AdminListService<T> = {
  search(params: SearchParams & WithOptions): Promise<PaginatedResult<T>>;
};

/**
 * 一覧の検索に足すオプション(page / limit / searchQuery 以外)。ルートの loader.ts で固定の値として書く
 * (リクエストごとに変わる値は key のプリミティブで渡す)。`extraWhere` 等の SQL が要る一覧は、そのルートの
 * _components/loader.ts に専用の取得を書く(README)
 */
export type AdminListSearchOptions = Pick<SearchParams, "orderBy" | "where" | "relationWhere"> &
  Pick<WithOptions, "withRelations" | "hasManyLimit">;

export type AdminListScreenData<T> = {
  /** 1 始まりの現在ページ */
  page: number;
  /** 1 ページの件数(設定 adminListPerPage) */
  limit: number;
  searchQuery: string | undefined;
  results: T[];
  total: number;
};

/** 設定の 1 ページ件数で検索する */
export async function fetchAdminList<T>(
  service: AdminListService<T>,
  page: number,
  searchQuery: string | undefined,
  options: AdminListSearchOptions = {},
): Promise<AdminListScreenData<T>> {
  const limit = await settingService.getAdminListPerPage();
  const { results, total } = await service.search({ ...options, page, limit, searchQuery });
  return { page, limit, searchQuery, results, total };
}
