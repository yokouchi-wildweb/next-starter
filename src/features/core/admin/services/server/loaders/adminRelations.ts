// src/features/core/admin/services/server/loaders/adminRelations.ts
// dc:generate が生成する管理画面(追加・編集)が関連ドメインの選択肢を SWR fallback として
// 事前取得するための共有 helper。一覧・規則: ./README.md

import "server-only";
import { cache } from "react";

/** 関連ドメインの service に要求する最小の形(createCrudService の list) */
export type AdminRelationService = {
  list(): Promise<unknown[]>;
};

export type AdminRelationLists<S extends Record<string, AdminRelationService>> = {
  [K in keyof S]: Awaited<ReturnType<S[K]["list"]>>;
};

const resolveAdminRelationLists = cache(
  async <S extends Record<string, AdminRelationService>>(services: S): Promise<AdminRelationLists<S>> => {
    const keys = Object.keys(services) as (keyof S)[];
    const lists = await Promise.all(keys.map((key) => services[key].list()));
    const result = {} as AdminRelationLists<S>;
    keys.forEach((key, index) => {
      result[key] = lists[index] as AdminRelationLists<S>[typeof key];
    });
    return result;
  },
);

/**
 * 関連ドメインの全件を並列取得し、SWRConfig の fallback に渡す形({ キー: 配列 })で返す。
 * キーは生成コードが決める(例: `{ sampleCategories: sampleCategoryService, sampleTags: sampleTagService }`)。
 * cache() のキーは services オブジェクトの同一性なので、Screen 内で 1 回だけ組み立てて渡す。
 */
export async function loadAdminRelationLists<S extends Record<string, AdminRelationService>>(
  services: S,
): Promise<AdminRelationLists<S>> {
  return resolveAdminRelationLists(services);
}
