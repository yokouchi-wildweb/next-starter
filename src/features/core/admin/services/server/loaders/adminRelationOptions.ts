// src/features/core/admin/services/server/loaders/adminRelationOptions.ts
// dc:generate が生成する管理画面(追加・編集)が、フォームの関連選択肢を SSR で先読みして
// SWRConfig の fallback に渡すための共有 loader。一覧・規則: ./README.md
//
// どの関連を読むか・どのキーで渡すかは src/lib/domain/relations/relationOptions.mjs の判定に従う
// (クライアントの useRelationOptions と同じ判定・同じキー)。service は serviceRegistry から
// 関連先ドメイン名で解決する(クライアントが叩く GET /api/<domain> と同じ解決経路。配線替えは別作業)ので、
// Screen は domain.json を渡すだけでよく、関連先の service を import しない。

import "server-only";
import { cache } from "react";

import {
  domainsFromRelationOptionsKey,
  getStaticRelations,
  relationOptionsKey,
} from "@/lib/domain/relations/relationOptions.mjs";
import { serviceRegistry } from "@/registry/serviceRegistry";
import { toCamelCase } from "@/utils/stringCase.mjs";

/** domain.json のうち loader が読む部分 */
export type AdminRelationOptionsConfig = {
  relations?: Array<{
    domain: string;
    relationType: string;
    formInput?: string;
    includeRelationTable?: boolean;
  }>;
};

/**
 * SWRConfig の fallback に渡す形。`{ [SWR キー]: { [関連先ドメイン]: 全件配列 } }`。
 * 全件取得する関連が無ければ空オブジェクト(Screen はそのまま fallback に渡してよい)
 */
export type AdminRelationOptionsFallback = Record<string, Record<string, unknown[]>>;

/** registry の service に要求する最小の形(createCrudService の list) */
type ListService = { list(): Promise<unknown[]> };

async function resolveListService(domain: string): Promise<ListService> {
  const key = toCamelCase(domain);
  const entry = Object.prototype.hasOwnProperty.call(serviceRegistry, key) ? serviceRegistry[key] : undefined;
  // 登録表のサービスは遅延読み込み（domainEntry.ts の service: () => import(...)）
  const service = entry ? ((await entry.service()) as Partial<ListService>) : undefined;
  if (!service || typeof service.list !== "function") {
    throw new Error(
      `adminRelationOptions: 関連先ドメイン "${domain}" の service が serviceRegistry に無いか list() を持たない(登録は services/server/domainEntry.ts)`,
    );
  }
  return service as ListService;
}

// cache() のキーは SWR キー文字列(プリミティブ)。同一リクエスト内で同じ関連集合なら 1 回だけ読む
const resolveAdminRelationOptions = cache(async (key: string): Promise<AdminRelationOptionsFallback> => {
  const domains = domainsFromRelationOptionsKey(key);
  const lists = await Promise.all(domains.map(async (domain) => (await resolveListService(domain)).list()));
  const byDomain: Record<string, unknown[]> = {};
  domains.forEach((domain, index) => {
    byDomain[domain] = lists[index];
  });
  return { [key]: byDomain };
});

/**
 * フォームの関連選択肢(全件取得する関連だけ)を並列に読み、useRelationOptions と同じ SWR キーで
 * fallback の形にして返す。Screen は `<SWRConfig value={{ fallback }}>` に渡す。
 * async / custom の関連と逆側の belongsToMany は読まない(クライアントも読まない)。
 */
export async function loadAdminRelationOptions(
  domainConfig: AdminRelationOptionsConfig,
): Promise<AdminRelationOptionsFallback> {
  const key = relationOptionsKey(getStaticRelations(domainConfig));
  if (!key) return {};
  return resolveAdminRelationOptions(key);
}
