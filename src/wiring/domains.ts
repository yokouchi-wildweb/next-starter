// src/wiring/domains.ts
// 登録表（src/registry/serviceRegistry.ts）と domain.json の一覧（domainConfigRegistry）を lib/domain の汎用関数に結んだ、
// サーバー用の getService 系（印なし = server 用。lib は登録表を import しないので、結ぶのはここ）。
//
// import してよい場所: src/app/**（API ルート・Screen・loader。cron のフォルダでは task.ts だけ）・src/proxies/**・src/proxy.ts。
// features / lib / components からは import しない（検査: pnpm test:wiring。一覧と向きは src/wiring/README.md）。
// サービスは遅延読み込みなので、このファイルを import しても各ドメインのサービス・DB 接続は読み込まれない。

import "server-only";

import {
  fetchAdminEdit,
  type AdminEditScreenData,
  type AdminEditService,
  type AdminEditScreenParams,
  type AdminEditScreenSearchParams,
} from "@/features/core/admin/services/server/screenData/adminEdit";
import {
  fetchAdminList,
  type AdminListScreenData,
  type AdminListService,
  type AdminListSearchOptions,
} from "@/features/core/admin/services/server/screenData/adminList";
import {
  fetchAdminRelationOptions,
  type AdminRelationOptionsConfig,
  type AdminRelationOptionsFallback,
  type AdminRelationTarget,
} from "@/features/core/admin/services/server/screenData/adminRelationOptions";
import { fetchAdminSort, type AdminSortScreenData, type AdminSortService } from "@/features/core/admin/services/server/screenData/adminSort";
import type { PgTable } from "drizzle-orm/pg-core";

import type { ListPageSearchParams } from "@/lib/crud/types";
import { resolveAccessRule, type DomainApiAccessRule, type DomainApiOperation } from "@/lib/domain";
import type { LoaderKeyValue, PageLoaderConfig } from "@/lib/pageGuard";
import { toCamelCase } from "@/utils/stringCase.mjs";

import {
  findDomainByTable as findDomainByTableFrom,
  getDomainList as getDomainListFrom,
  getDomainListWithCount as getDomainListWithCountFrom,
  getDomainTable as getDomainTableFrom,
  getInvalidDomainKeys as getInvalidDomainKeysFrom,
  getJunctionTable as getJunctionTableFrom,
  getService as getServiceFrom,
  getServiceOrThrow as getServiceOrThrowFrom,
  hasService as hasServiceFrom,
  isValidDomainKey as isValidDomainKeyFrom,
  lookupDomainService as lookupDomainServiceFrom,
  withRecordCounts as withRecordCountsFrom,
} from "@/lib/domain/server";
import type { DomainTable } from "@/lib/domain/server";
import type { DomainApiAccessConfig, DomainInfo, DomainService, DomainServiceLookup } from "@/lib/domain/types";
import { domainConfigMap } from "@/registry/domainConfigRegistry";
import { serviceRegistry } from "@/registry/serviceRegistry";

/** 中間表の名前（snake_case）から表を引く。表の定義は呼ばれたときに読む（このファイルの import を軽く保つ） */
export const getJunctionTable = async (tableName: string): Promise<PgTable | undefined> =>
  getJunctionTableFrom(await import("@/registry/schemaRegistry"), tableName);

/** 登録表にキーがあるか（同期。サービスは読み込まない） */
export const hasService = (key: string): boolean => hasServiceFrom(serviceRegistry, key);

/** ドメインキー（camelCase）からサービスを引く。未登録なら undefined、読み込み失敗は throw */
export const getService = <T extends DomainService = DomainService>(key: string): Promise<T | undefined> =>
  getServiceFrom<T>(serviceRegistry, key);

/** ドメインキーからサービスを引く。未登録なら throw */
export const getServiceOrThrow = <T extends DomainService = DomainService>(key: string): Promise<T> =>
  getServiceOrThrowFrom<T>(serviceRegistry, key);

/** ドメインキーからサービスを引き、引けない理由（未登録・読み込み失敗・操作が無い）を状態で返す */
export const lookupDomainService = <T extends DomainService = DomainService>(
  key: string,
  options?: { require?: ReadonlyArray<keyof DomainService> },
): Promise<DomainServiceLookup<T>> => lookupDomainServiceFrom<T>(serviceRegistry, key, options);

/** 表の物理名 → ドメインキー（同期。サービスは読み込まない）。登録の無い表（中間表・履歴など）は null */
export const findDomainByTable = (tableName: string): string | null => findDomainByTableFrom(serviceRegistry, tableName);

/** ドメインキー → 表と主キー列の物理名（同期。サービスは読み込まない）。未登録と Firestore 版は null */
export const getDomainTable = (key: string): DomainTable | null => getDomainTableFrom(serviceRegistry, key);

/** ドメインキーの access（汎用 API・管理データ操作の認可宣言）。未登録なら undefined */
export const getDomainAccess = (key: string): DomainApiAccessConfig | undefined =>
  hasServiceFrom(serviceRegistry, key) ? serviceRegistry[key].access : undefined;

/** 全件削除できるドメインの一覧（truncateAll 対応のものだけ。access の評価は呼び手が行う） */
export const getDomainList = () => getDomainListFrom(serviceRegistry, domainConfigMap);

/** 全件削除できるドメインの一覧（レコード数付き） */
export const getDomainListWithCount = () => getDomainListWithCountFrom(serviceRegistry, domainConfigMap);

/** ドメイン一覧にレコード数を付ける（access で絞った後に使う） */
export const withRecordCounts = (domains: readonly DomainInfo[]) => withRecordCountsFrom(serviceRegistry, domains);

/** ドメインキーが全件削除できるか（登録済みかつ truncateAll 対応） */
export const isValidDomainKey = (key: string) => isValidDomainKeyFrom(serviceRegistry, key);

/** 全件削除できないキーを返す */
export const getInvalidDomainKeys = (keys: readonly string[]) => getInvalidDomainKeysFrom(serviceRegistry, keys);

// ===== 管理画面の共通部品の組（ルートの _screen/loader.ts が最寄りの guard.ts の createLoader に渡す） =====
// access は汎用 API（createDomainRoute）と同じく serviceRegistry の entry から resolveAccessRule で操作ごとに解く。
// 取得本体は features/core/admin の screenData（service は外から受ける）。loader.ts の書き方: src/features/core/admin/services/server/screenData/README.md

/** 管理画面の組の型（利用者の型は見ないので unknown。createLoader に渡すと範囲の利用者の型で評価される） */
type AdminParts<TProps, TKey extends readonly LoaderKeyValue[], TData> = PageLoaderConfig<TProps, TKey, TData, unknown>;

/** 登録表の entry の access を操作ごとに解く（未登録はモジュール読み込み時に throw = 生成・配線のミスを即座に出す） */
function domainAccess(domainKey: string, operation: DomainApiOperation, operationType: "read" | "write"): DomainApiAccessRule {
  if (!hasServiceFrom(serviceRegistry, domainKey)) {
    throw new Error(`管理画面の loader: ドメイン "${domainKey}" が serviceRegistry に無い(登録は services/server/domainEntry.ts)`);
  }
  return resolveAccessRule(serviceRegistry[domainKey].access, operation, operationType);
}

/** ドメインのサービスを引き、取得本体が使う操作を持つか確かめる（持たなければ throw = 配線のミス） */
async function serviceWith<TService>(domainKey: string, method: string): Promise<TService> {
  const service = (await getServiceOrThrow(domainKey)) as Record<string, unknown>;
  if (typeof service[method] !== "function") {
    throw new Error(`管理画面の loader: ドメイン "${domainKey}" の service が ${method}() を持たない`);
  }
  return service as TService;
}

/** 関連先（domain.json の表記）の list の access と取得。引けなければ throw */
function relationTarget(domain: string): AdminRelationTarget {
  const key = toCamelCase(domain);
  if (!hasServiceFrom(serviceRegistry, key)) {
    throw new Error(`管理画面の関連選択肢: 関連先ドメイン "${domain}" が serviceRegistry に無い(登録は services/server/domainEntry.ts)`);
  }
  return {
    access: resolveAccessRule(serviceRegistry[key].access, "list", "read"),
    list: async () => {
      const service = await serviceWith<{ list: () => Promise<unknown[]> }>(key, "list");
      return service.list();
    },
  };
}

/** 関連選択肢（全件取得する関連が無ければ {}）。関連先ごとに list の access を取得前に評価する */
const relationOptions = (domainConfig: AdminRelationOptionsConfig | undefined, allows: (rule: DomainApiAccessRule) => boolean) =>
  domainConfig ? fetchAdminRelationOptions(domainConfig, { resolveTarget: relationTarget, allows }) : Promise.resolve({});

export type AdminListScreenProps = { searchParams: Promise<ListPageSearchParams> };

/** 一覧（access = search）。`?page=` と `?searchQuery=` が cache のキー。options は固定の検索条件（関連の展開・絞り込み） */
export function adminListParts<T>(
  domainKey: string,
  options?: AdminListSearchOptions,
): AdminParts<AdminListScreenProps, [number, string | undefined], AdminListScreenData<T>> {
  return {
    access: domainAccess(domainKey, "search", "read"),
    key: async (props) => {
      const { page, searchQuery } = await props.searchParams;
      return [Number(page ?? "1"), searchQuery];
    },
    load: async (_ctx, page, searchQuery) =>
      fetchAdminList(await serviceWith<AdminListService<T>>(domainKey, "search"), page, searchQuery, options),
  };
}

export type AdminEditScreenProps = {
  params: Promise<AdminEditScreenParams>;
  searchParams: Promise<AdminEditScreenSearchParams>;
};
export type AdminEditScreenLoaded<T> = AdminEditScreenData<T> & { relationFallback: AdminRelationOptionsFallback };

/** 編集（access = get）。レコードが無ければ 404、保存後の戻り先は ?returnTo=（無ければ fallbackPath）。relations = domain.json（関連選択肢の先読み） */
export function adminEditParts<T>(
  domainKey: string,
  config: { fallbackPath: string; relations?: AdminRelationOptionsConfig },
): AdminParts<AdminEditScreenProps, [string, string | undefined], AdminEditScreenLoaded<T>> {
  return {
    access: domainAccess(domainKey, "get", "read"),
    key: async (props) => {
      const [{ id }, { returnTo }] = await Promise.all([props.params, props.searchParams]);
      return [id, returnTo];
    },
    load: async ({ allows }, id, returnTo) => {
      const [edit, relationFallback] = await Promise.all([
        serviceWith<AdminEditService<T>>(domainKey, "get").then((service) => fetchAdminEdit(service, id, returnTo, config.fallbackPath)),
        relationOptions(config.relations, allows),
      ]);
      return { ...edit, relationFallback };
    },
  };
}

export type AdminCreateScreenLoaded = { relationFallback: AdminRelationOptionsFallback };

/** 追加（access = create）。取得は関連選択肢の先読みだけ（relations が無ければ access の判定だけ） */
export function adminCreateParts(
  domainKey: string,
  config: { relations?: AdminRelationOptionsConfig } = {},
): AdminParts<unknown, [], AdminCreateScreenLoaded> {
  return {
    access: domainAccess(domainKey, "create", "write"),
    load: async ({ allows }) => ({ relationFallback: await relationOptions(config.relations, allows) }),
  };
}

/** 並び替え（access = searchForSorting）。sortOrderColumn 昇順で先頭 100 件 */
export function adminSortParts<T>(
  domainKey: string,
  sortOrderColumn = "sort_order",
): AdminParts<unknown, [], AdminSortScreenData<T>> {
  return {
    access: domainAccess(domainKey, "searchForSorting", "read"),
    load: async () => fetchAdminSort(await serviceWith<AdminSortService<T>>(domainKey, "searchForSorting"), sortOrderColumn),
  };
}
