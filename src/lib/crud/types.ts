// src/lib/crud/types.ts

export type QueryOp =
  | "eq"
  | "ne"
  | "lt"
  | "lte"
  | "gt"
  | "gte"
  | "like";

export type WhereExpr =
  | { field: string; op: QueryOp; value: unknown }
  | { and: WhereExpr[] }
  | { or: WhereExpr[] };

/** Tuple array specifying field name and sort direction. */
export type OrderBySpec = Array<[string, "ASC" | "DESC"]>;

export type SearchParams = {
  page?: number;
  limit?: number;
  orderBy?: OrderBySpec;
  searchQuery?: string;
  searchFields?: string[];
  /**
   * 検索キーワードのヒット列に応じた並び替え優先度を指定する。
   * `prioritizeSearchHits` が `false` の場合は `orderBy` 適用後のタイブレークとして利用される。
   */
  searchPriorityFields?: string[];
  /**
   * true の場合は検索ヒット優先度（searchPriorityFields）を orderBy よりも前に適用する。
   */
  prioritizeSearchHits?: boolean;
  where?: WhereExpr;
};

export type PaginatedResult<T> = {
  results: T[];
  total: number;
};

export type UpsertOptions<TData> = {
  /**
   * 指定されたフィールドを衝突検知の対象にする。
   * 省略した場合は `id` カラムを利用する。
   */
  conflictFields?: Array<Extract<keyof TData, string>>;
};

export type ApiClient<T, CreateData = Partial<T>, UpdateData = Partial<T>> = {
  getAll(): Promise<T[]>;
  getById(id: string): Promise<T>;
  create(data: CreateData): Promise<T>;
  update(id: string, data: UpdateData): Promise<T>;
  delete(id: string): Promise<void>;
  search?(params: SearchParams): Promise<PaginatedResult<T>>;
  bulkDelete?(ids: string[]): Promise<void>;
  upsert?(data: CreateData, options?: UpsertOptions<CreateData>): Promise<T>;
};

export type IdType = "uuid" | "db" | "manual";

type BaseCrudServiceOptions = {
  /**
   * How to assign the `id` field when creating a record.
   *
   * - `"uuid"`   - Auto-generate with `uuidv7()`
   * - `"db"`     - Let the DB handle it
   * - `"manual"` - Caller provides the id
   */
  idType?: IdType;
  /**
   * Column names searched when a query string is provided.
   */
  defaultSearchFields?: string[];
  /**
   * CASE WHEN による検索ヒット優先度を決めるフィールド順。
   * `search()` 実行時に `searchPriorityFields` が指定されていなければこちらが利用される。
   */
  defaultSearchPriorityFields?: string[];
  /**
   * true の場合は検索ヒット優先度を orderBy よりも前に適用する。
   */
  prioritizeSearchHitsByDefault?: boolean;
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
};

type MaybePromise<T> = T | Promise<T>;

export type CreateCrudServiceOptions<TData extends Record<string, any> = Record<string, any>> =
  BaseCrudServiceOptions & {
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
