// src/lib/domain/types/registry.ts
// serviceRegistry（ドメイン名 → サービス・表・主キーを引く正式な仕組み）の型
//
// 登録の単位は各ドメインの services/server/domainEntry.ts（1 ドメイン 1 ファイル、キー付きオブジェクト）。
// src/registry/serviceRegistry.ts は pnpm registry:generate が全 domainEntry.ts を走査して生成する。
// サービスは遅延読み込み（`service: () => import(...)`）なので、登録表を import しても各ドメインの
// サービス・DB 接続は読み込まれない。詳細: src/lib/domain/README.md

import type { DomainApiAccessConfig } from "./apiAccess";

// サービスのメソッドはドメインごとに引数・戻り値が違うため、構造型では緩い関数型で受ける
type AnyServiceMethod = (...args: any[]) => any;

/**
 * 登録表から引いたサービスの構造型（createCrudService の操作。全操作 optional）。
 * Drizzle 版は全部を持ち、Firestore 版は truncateAll / getTableName / getIdColumnName を持たない。
 * 呼び手は使う操作の有無を確かめてから呼ぶ（lookupDomainService の require で宣言できる）。
 */
export type DomainService = {
  create?: AnyServiceMethod;
  list?: AnyServiceMethod;
  listWithDeleted?: AnyServiceMethod;
  get?: AnyServiceMethod;
  getWithDeleted?: AnyServiceMethod;
  update?: AnyServiceMethod;
  remove?: AnyServiceMethod;
  restore?: AnyServiceMethod;
  hardDelete?: AnyServiceMethod;
  count?: AnyServiceMethod;
  countWithDeleted?: AnyServiceMethod;
  search?: AnyServiceMethod;
  /** 論理削除済みを含む検索（id の存在確認・export に使う） */
  searchWithDeleted?: AnyServiceMethod;
  searchForSorting?: AnyServiceMethod;
  query?: AnyServiceMethod;
  upsert?: AnyServiceMethod;
  duplicate?: AnyServiceMethod;
  reorder?: AnyServiceMethod;
  bulkUpsert?: AnyServiceMethod;
  bulkUpdate?: AnyServiceMethod;
  bulkUpdateByIds?: AnyServiceMethod;
  bulkDeleteByIds?: AnyServiceMethod;
  bulkDeleteByQuery?: AnyServiceMethod;
  bulkHardDeleteByIds?: AnyServiceMethod;
  replaceByQuery?: AnyServiceMethod;
  /** 全件削除（Drizzle 版のみ。本表と belongsToMany の中間表） */
  truncateAll?: () => Promise<string[]>;
  getTruncateAffectedTables?: () => Promise<string[]>;
  /** 表の物理名（Drizzle 版のみ） */
  getTableName?: () => string;
  /** 主キー列の物理名（Drizzle 版のみ。論理名は lib/crud の CRUD_ID_FIELD = "id"） */
  getIdColumnName?: () => string;
  /** storage オプション付きサービスのメディア列宣言 */
  storageFields?: ReadonlyArray<{ name: string; purpose: string; multi?: boolean }>;
  invalidateRequestMemo?: AnyServiceMethod;
};

/**
 * ドメイン登録エントリ（domainEntry.ts の 1 キー分）。
 * service は遅延読み込み（`() => import("./xService").then((m) => m.xService)`）。
 * access は型必須: 「サービスを登録したが認可ポリシーを宣言し忘れる」ことを構造的に防ぐ
 * （fail-closed by construction）。汎用ルート（createDomainRoute）と管理データ操作のルートは
 * このエントリの access を唯一の実行時ソースとして認可する。
 */
export type DomainRegistryEntry = {
  service: () => Promise<DomainService>;
  access: DomainApiAccessConfig;
  /**
   * 表の物理名（サービスを読み込まずに引くため。サービスの getTableName() と同じ値）。
   * null は表を持たない Firestore 版のドメインだけ。業務ドメインは dc:generate が書き、core は手書き
   */
  table: string | null;
  /**
   * 主キー列の物理名（サービスの getIdColumnName() と同じ値。論理名は常に lib/crud の CRUD_ID_FIELD = "id"）。
   * null は表を持たない Firestore 版のドメインだけ。業務ドメインは dc:generate が書き、core は手書き
   */
  idColumn: string | null;
};

/** domainEntry.ts の export（`export const domainEntries = { ... } satisfies DomainEntries`） */
export type DomainEntries = Record<string, DomainRegistryEntry>;

/**
 * fork の上書き（domainEntry.override.ts、`export const domainEntryOverrides = { ... } satisfies DomainEntryOverrides`）。
 * キー = 隣の domainEntry.ts のキー、値 = access の丸ごと置き換え。生成器が読んで serviceRegistry に反映する
 */
export type DomainEntryOverrides = Record<string, DomainApiAccessConfig>;

/** 生成された登録表（src/registry/serviceRegistry.ts の serviceRegistry） */
export type DomainRegistry = Readonly<Record<string, DomainRegistryEntry>>;

/**
 * lookupDomainService の戻り。「行なし」と区別できるよう、引けない理由を状態で返す。
 * - found: サービスを引けた（require で求めた操作もある）
 * - unregistered: 登録表にキーが無い
 * - load_failed: 遅延読み込みが例外を投げた（モジュール不在・初期化失敗）
 * - unsupported: 引けたが require で求めた操作を持たない（Firestore 版の truncateAll 等）
 */
export type DomainServiceLookup<T extends DomainService = DomainService> =
  | { status: "found"; service: T }
  | { status: "unregistered" }
  | { status: "load_failed"; error: unknown }
  | { status: "unsupported"; missing: Array<keyof DomainService> };
