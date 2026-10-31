// src/wiring/domainRegistry.ts
// 登録表（src/registry/serviceRegistry.ts）と domain.json の一覧（domainConfigRegistry）を lib/domain の汎用関数に結んだ、
// サーバー用の getService 系（印なし = server 用。lib は登録表を import しないので、結ぶのはここ）。
//
// import してよい場所: src/app/**（API ルート・Screen・loader。cron のフォルダでは task.ts だけ）・src/proxies/**・src/proxy.ts。
// features / lib / components からは import しない（検査: pnpm test:wiring。一覧と向きは src/wiring/README.md）。
// サービスは遅延読み込みなので、このファイルを import しても各ドメインのサービス・DB 接続は読み込まれない。

import "server-only";

import type { PgTable } from "drizzle-orm/pg-core";

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
