// src/lib/crud/types/serviceOptions.ts
// CRUD サービス(Drizzle / Firestore 共通)のオプション

import type { OrderBySpec, SearchRankSpec } from "./query";

/** レコードの id の付け方（サービスのオプション idType の値） */
export type IdStrategy = "uuid" | "db" | "manual" | "string";

type MaybePromise<T> = T | Promise<T>;

/**
 * createCrudService(Drizzle)と createFirestoreCrudService が共通で受けるオプション。
 * Drizzle は CrudServiceOptions、Firestore は FirestoreCrudServiceOptions がこれを土台にする。
 */
export type CrudServiceBaseOptions<TData extends Record<string, any> = Record<string, any>> = {
  /**
   * How to assign the `id` field when creating a record.
   *
   * - `"uuid"`   - Auto-generate with `uuidv7()`
   * - `"db"`     - Let the DB handle it
   * - `"manual"` - Caller provides the id
   */
  idType?: IdStrategy;
  /**
   * Column names searched when a query string is provided.
   */
  defaultSearchFields?: string[];
  /**
   * 関連度ランキング（`searchRank: true`）時に使うフィールドと重みの既定値。
   * 未設定なら `searchFields` を等重みで使用する。ランキングの ON/OFF は呼び出し側
   * （`searchRank` パラメータ）が決める。この値は「どう並べるか」の既定のみ。
   * Drizzle 専用。
   */
  defaultSearchRank?: SearchRankSpec;
  /**
   * Default sort order applied by `list()` and `search()` when
   * no explicit order is provided.
   *
   * Example:
   * `[["updatedAt", "DESC"], ["name", "ASC"]]`
   */
  defaultOrderBy?: OrderBySpec;
  /**
   * 自動的に `createdAt` を現在時刻で補完するかどうか。
   */
  useCreatedAt?: boolean;
  /**
   * 自動的に `updatedAt` を現在時刻で補完するかどうか。
   */
  useUpdatedAt?: boolean;
  /**
   * 論理削除（ソフトデリート）を使用するかどうか。
   * true の場合、delete() は物理削除ではなく deletedAt を設定する。
   * list(), get(), search() は deletedAt IS NULL のレコードのみ返す。
   */
  useSoftDelete?: boolean;
  /**
   * `upsert` を実行する際のデフォルト衝突検知フィールド。
   * 呼び出し側で `conflictFields` を指定した場合はそちらが優先される。
   */
  defaultUpsertConflictFields?: Array<Extract<keyof TData, string>>;
  /**
   * 保存前に実行する正規化処理。ドメインスキーマでのパース結果を利用する。
   */
  parseCreate?: (data: TData) => MaybePromise<TData>;
  /**
   * 更新前に実行する正規化処理。部分更新を想定したパース結果を利用する。
   */
  parseUpdate?: (data: Partial<TData>) => MaybePromise<Partial<TData>>;
  /**
   * upsert 前に実行する正規化処理。指定が無い場合は `parseCreate` を利用する。
   */
  parseUpsert?: (data: TData) => MaybePromise<TData>;
};
