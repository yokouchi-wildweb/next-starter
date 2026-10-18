// src/features/core/admin/services/server/loaders/adminList.ts
// dc:generate が生成する管理画面(一覧)の共有 loader。一覧・規則: ./README.md

import "server-only";
import { cache } from "react";

import type { ListPageSearchParams, PaginatedResult, SearchParams, WithOptions } from "@/lib/crud/types";
import { settingService } from "@/features/core/setting/services/server/settingService";

/** 一覧 loader が service に要求する最小の形(createCrudService の search) */
export type AdminListService<T> = {
  search(params: SearchParams & WithOptions): Promise<PaginatedResult<T>>;
};

/**
 * 一覧の検索に足すオプション(page / limit / searchQuery 以外)。JSON にできるものだけ:
 * cache() のキーに JSON 文字列を使うため。`extraWhere`(SQL オブジェクト)は渡せない。
 * それが要る一覧は、そのルートの _components/loader.ts に専用 loader を書く(README)
 */
export type AdminListSearchOptions = Pick<SearchParams, "orderBy" | "where" | "relationWhere"> &
  Pick<WithOptions, "withRelations" | "hasManyLimit">;

/** 一覧画面の props(ScreenProps<Record<string, never>, ListPageSearchParams> と互換) */
export type AdminListScreenProps = {
  searchParams: Promise<ListPageSearchParams>;
};

export type AdminListScreenData<T> = {
  /** 1 始まりの現在ページ */
  page: number;
  /** 1 ページの件数(設定 adminListPerPage) */
  limit: number;
  searchQuery: string | undefined;
  results: T[];
  total: number;
};

// cache() のキーは引数の同一性。service はモジュール単位のシングルトン、残りはプリミティブ
// (options はオブジェクトなので JSON 文字列にしてから渡す)
const resolveAdminListScreen = cache(
  async <T,>(
    service: AdminListService<T>,
    page: number,
    searchQuery: string | undefined,
    optionsJson: string | undefined,
  ): Promise<AdminListScreenData<T>> => {
    const limit = await settingService.getAdminListPerPage();
    const options: AdminListSearchOptions = optionsJson ? JSON.parse(optionsJson) : {};
    const { results, total } = await service.search({ ...options, page, limit, searchQuery });
    return { page, limit, searchQuery, results, total };
  },
);

/**
 * 生成された管理画面(一覧)のデータ。`?page=` と `?searchQuery=` を解釈し、設定の 1 ページ件数で検索する。
 * 認可は admin/(protected)/layout.tsx の authGuard が担うため、ここでは行わない(wallet の loader と異なる点)。
 * @param options 関連の展開(withRelations)や並び順・絞り込みを足すとき(差し替えた Screen から渡す)。省略時は従来どおり
 */
export async function loadAdminListScreen<T>(
  service: AdminListService<T>,
  props: AdminListScreenProps,
  options?: AdminListSearchOptions,
): Promise<AdminListScreenData<T>> {
  const { page: pageStr, searchQuery } = await props.searchParams;
  const page = Number(pageStr ?? "1");
  const optionsJson = options && Object.keys(options).length > 0 ? JSON.stringify(options) : undefined;
  return resolveAdminListScreen(service, page, searchQuery, optionsJson);
}
