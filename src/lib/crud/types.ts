// src/lib/crud/types.ts

// ============================================================
// エンティティ基本型
// ============================================================

export interface BaseEntity {
  id: string;
  createdAt: Date | null;
  updatedAt: Date | null;
}

// ============================================================
// ページ検索パラメータ
// ============================================================

export type ListPageSearchParams = {
  page?: string;
  searchQuery?: string;
  sortBy?: string;
};

// ============================================================
// クエリ・検索
// ============================================================

export type QueryOp =
  | "eq"
  | "ne"
  | "lt"
  | "lte"
  | "gt"
  | "gte"
  | "like"
  | "in"
  | "notIn";

export type WhereExpr =
  | { field: string; op: QueryOp; value: unknown }
  | { and: WhereExpr[] }
  | { or: WhereExpr[] };

/**
 * Tuple array specifying field name, sort direction, and optional nulls handling.
 * - [field, direction] or [field, direction, nulls]
 * - direction: "ASC" | "DESC"
 * - nulls: "FIRST" | "LAST" (optional)
 */
export type OrderBySpec = Array<[string, "ASC" | "DESC", ("FIRST" | "LAST")?]>;

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

export type BulkUpsertOptions<TData> = {
  /**
   * 指定されたフィールドを衝突検知の対象にする。
   * 省略した場合は `id` カラムを利用する。
   */
  conflictFields?: Array<Extract<keyof TData, string>>;
  /**
   * true の場合、衝突時にレコードを更新せずスキップする。
   */
  skipDuplicates?: boolean;
  /**
   * ON CONFLICT DO UPDATE の SET から除外するフィールド。
   * 指定されたフィールドは INSERT 時のみ値が設定され、
   * UPDATE 時は既存の値が保持される。
   * 画像フィールドなど、後から個別に更新するフィールドに使用する。
   */
  excludeFromUpdate?: string[];
};

export type BulkUpsertResult<T> = {
  /** upsertされたレコード一覧 */
  results: T[];
  /** 処理されたレコード数 */
  count: number;
};

/**
 * バルクアップデート用のレコード型。
 * idと更新データをセットで渡す。
 */
export type BulkUpdateRecord<UpdateData> = {
  id: string;
  data: UpdateData;
};

export type BulkUpdateResult<T> = {
  /** 更新されたレコード一覧 */
  results: T[];
  /** 更新されたレコード数 */
  count: number;
  /** 存在しなかったID一覧 */
  notFoundIds: string[];
};

export type ApiClient<T, CreateData = Partial<T>, UpdateData = Partial<T>> = {
  getAll(options?: WithOptions): Promise<T[]>;
  getById(id: string, options?: WithOptions): Promise<T>;
  create(data: CreateData): Promise<T>;
  update(id: string, data: UpdateData): Promise<T>;
  delete(id: string): Promise<void>;
  search?(params: SearchParams & WithOptions): Promise<PaginatedResult<T>>;
  bulkDeleteByIds?(ids: string[]): Promise<void>;
  bulkDeleteByQuery?(where: WhereExpr): Promise<void>;
  upsert?(data: CreateData, options?: UpsertOptions<CreateData>): Promise<T>;
  bulkUpsert?(records: CreateData[], options?: BulkUpsertOptions<CreateData>): Promise<BulkUpsertResult<T>>;
  bulkUpdate?(records: BulkUpdateRecord<UpdateData>[]): Promise<BulkUpdateResult<T>>;
  duplicate?(id: string): Promise<T>;
  // ソフトデリート用メソッド
  restore?(id: string): Promise<T>;
  hardDelete?(id: string): Promise<void>;
  getAllWithDeleted?(options?: WithOptions): Promise<T[]>;
  getByIdWithDeleted?(id: string, options?: WithOptions): Promise<T>;
  searchWithDeleted?(params: SearchParams & WithOptions): Promise<PaginatedResult<T>>;
  // 並び替え用メソッド
  reorder?(id: string, afterItemId: string | null): Promise<T>;
  /**
   * ソート画面用検索。sort_order が NULL のレコードを自動初期化する。
   */
  searchForSorting?(params: SearchParams): Promise<PaginatedResult<T>>;
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
  /**
   * 論理削除（ソフトデリート）を使用するかどうか。
   * true の場合、remove() は物理削除ではなく deletedAt を設定する。
   * list(), get(), search() は deletedAt IS NULL のレコードのみ返す。
   */
  useSoftDelete?: boolean;
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

// ============================================================
// withRelations / withCount オプション
// ============================================================

/**
 * GET系メソッド（get, list, search）で使用するオプション。
 * リレーション展開やカウント取得を制御する。
 */
export type WithOptions = {
  /**
   * リレーション先のオブジェクトを展開する深さを指定する。
   * - false/undefined: 展開しない
   * - true/1: 1階層（リレーション先のみ）
   * - 2: 2階層（リレーション先のリレーションも展開）
   *
   * 例:
   * - belongsTo: 外部キー → オブジェクト（例: sample_category_id → sample_category）
   * - belongsToMany: ID配列 → オブジェクト配列（例: sample_tag_ids → sample_tags）
   */
  withRelations?: boolean | number;
  /**
   * true の場合、リレーション先のレコード数を _count に含めて返す。
   * 例: _count: { sample_tags: 5 }
   */
  withCount?: boolean;
  /**
   * 取得件数の上限。デフォルト: 100。
   * 全件取得が必要な場合は listAll() を使用する。
   */
  limit?: number;
};

// ============================================================
// リレーション設定型（createCrudService に渡す）
// ============================================================

/**
 * ネストリレーション設定。
 * 2階層目のリレーション展開に使用する。
 */
export type NestedRelations = {
  belongsTo?: BelongsToRelation[];
  belongsToMany?: BelongsToManyObjectRelation[];
};

/**
 * belongsTo リレーション設定。
 * 外部キーからリレーション先のオブジェクトを取得する。
 */
export type BelongsToRelation<TTable = any> = {
  /** 展開後のフィールド名（例: "sample_category"） */
  field: string;
  /** 外部キーのフィールド名（例: "sample_category_id"） */
  foreignKey: string;
  /** リレーション先のテーブル（例: SampleCategoryTable） */
  table: TTable;
  /** 取得するカラム名（省略時は全カラム） */
  targetFields?: string[];
  /**
   * 2階層目のリレーション設定。
   * withRelations: 2 の場合にこのリレーション先のさらにリレーションを展開する。
   */
  nested?: NestedRelations;
};

/**
 * belongsToMany リレーションのオブジェクト展開設定。
 * 中間テーブルを経由してリレーション先のオブジェクト配列を取得する。
 */
export type BelongsToManyObjectRelation<
  TTargetTable = any,
  TThroughTable = any,
  TSourceColumn = any,
  TTargetColumn = any,
> = {
  /** 展開後のフィールド名（例: "sample_tags"） */
  field: string;
  /** リレーション先のテーブル（例: SampleTagTable） */
  targetTable: TTargetTable;
  /** 中間テーブル（例: SampleToSampleTagTable） */
  throughTable: TThroughTable;
  /** 中間テーブルの source 側カラム（例: SampleToSampleTagTable.sampleId） */
  sourceColumn: TSourceColumn;
  /** 中間テーブルの target 側カラム（例: SampleToSampleTagTable.sampleTagId） */
  targetColumn: TTargetColumn;
  /** 取得するカラム名（省略時は全カラム） */
  targetFields?: string[];
  /**
   * 2階層目のリレーション設定。
   * withRelations: 2 の場合にこのリレーション先のさらにリレーションを展開する。
   */
  nested?: NestedRelations;
};

/**
 * belongsToMany リレーションのカウント設定。
 * 中間テーブルを経由してリレーション先のレコード数を取得する。
 */
export type CountableRelation<TThroughTable = any> = {
  /** カウントフィールド名（例: "sample_tags"） */
  field: string;
  /** 中間テーブル（例: SampleToSampleTagTable） */
  throughTable: TThroughTable;
  /** 中間テーブルの source 側外部キー名（例: "sampleId"） */
  foreignKey: string;
};
