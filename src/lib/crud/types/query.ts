// src/lib/crud/types/query.ts
// 絞り込み(WhereExpr・リレーションのフィルタ)・並び・関連度・検索と件数のパラメータと結果

// ============================================================
// クエリ・検索
// ============================================================

export type QueryOp =
  // 比較
  | "eq"
  | "ne"
  | "lt"
  | "lte"
  | "gt"
  | "gte"
  // テキスト
  | "like"
  | "startsWith"
  | "endsWith"
  // リスト
  | "in"
  | "notIn"
  // NULL
  | "isNull"
  | "isNotNull"
  // JSONB
  | "contains"
  | "containedBy"
  | "hasKey"
  // PostgreSQL 配列
  | "arrayContains"
  | "arrayOverlaps";

export type WhereExpr =
  | { field: string; op: Exclude<QueryOp, "isNull" | "isNotNull">; value: unknown }
  // isNull / isNotNull は値を使わない（value: null などを渡してもよい）
  | { field: string; op: "isNull" | "isNotNull"; value?: unknown }
  | { and: WhereExpr[] }
  | { or: WhereExpr[] };

// ============================================================
// リレーションフィルタ
// ============================================================

/**
 * belongsToMany リレーション経由のフィルタリング条件。
 * createCrudService に登録済みの belongsToManyRelations を fieldName で参照し、
 * 中間テーブル経由でターゲットIDによる絞り込みを行う。
 *
 * - "any": いずれかの targetId を持つレコードに一致（デフォルト）
 * - "all": すべての targetId を持つレコードに一致
 * - "none": いずれの targetId も持たないレコードに一致（除外フィルタ）
 *
 * targetIds が空配列の場合はそのフィルタをスキップする（no-op）。
 */
export type BelongsToManyFilter = {
  /** belongsToManyRelations の fieldName で参照（例: "sampleTagIds"） */
  relationField: string;
  /** フィルタ対象のターゲットID群（空配列 = スキップ） */
  targetIds: string[];
  /** フィルタモード（デフォルト: "any"） */
  mode?: "any" | "all" | "none";
};

/**
 * belongsTo リレーション先テーブルのカラム条件によるフィルタリング。
 * createCrudService に登録済みの belongsToRelations を field で参照し、
 * リレーション先テーブルに対する WHERE 条件で絞り込む。
 *
 * 生成 SQL: EXISTS (SELECT 1 FROM <relatedTable> WHERE <relatedTable>.id = <mainTable>.<foreignKey> AND <where条件>)
 */
export type BelongsToFilter = {
  /** belongsToRelations の field で参照（例: "user"） */
  relationField: string;
  /** リレーション先テーブルのカラムに対する条件 */
  where: WhereExpr;
};

/**
 * リレーションフィルタの統合型。
 * - targetIds を持つ → BelongsToManyFilter（M2M）
 * - where を持つ → BelongsToFilter（belongsTo）
 */
export type RelationFilter = BelongsToManyFilter | BelongsToFilter;

/**
 * Tuple array specifying field name, sort direction, and optional nulls handling.
 * - [field, direction] or [field, direction, nulls]
 * - direction: "ASC" | "DESC"
 * - nulls: "FIRST" | "LAST" (optional)
 */
export type OrderBySpec = Array<[string, "ASC" | "DESC", ("FIRST" | "LAST")?]>;

/**
 * 関連度ランキングの対象フィールド。
 * 文字列指定は weight 1 と同義。
 */
export type SearchRankField = string | { field: string; weight?: number };

/**
 * 関連度ランキング（searchRank）の仕様。
 *
 * フィールドごとに「完全一致 > 前置一致 > 語頭一致 > 部分一致」の階層スコアを算出し、
 * weight を掛けて合算した値を ORDER BY の先頭に置く（複数フィールド一致は合算で自然に加点）。
 * - fields 省略時は `searchFields` を等重みで使用する
 * - fields は `searchFields` と実在カラムの交差に限定される（それ以外は無視、fail-closed）
 * - WHERE 条件（結果集合・count）には影響しない。searchQuery 無しの呼び出しでは no-op
 * - Drizzle 専用（Firestore では無視される）
 */
export type SearchRankSpec = {
  fields?: SearchRankField[];
};

export type SearchParams = {
  page?: number;
  limit?: number;
  orderBy?: OrderBySpec;
  searchQuery?: string;
  searchFields?: string[];
  /**
   * 関連度ランキングを有効にする。
   * - `true`: サービスの `defaultSearchRank`、無ければ `searchFields` 等重み
   * - `SearchRankSpec`: 呼び出しごとに重みを指定
   * - 未指定 / `false`: ランキングなし（orderBy のみ）
   */
  searchRank?: boolean | SearchRankSpec;
  where?: WhereExpr;
  /**
   * リレーション経由のフィルタリング（belongsToMany / belongsTo 両対応）。
   * 複数指定した場合は AND で合成される。
   * Drizzle 専用（Firestore では無視される）。
   */
  relationWhere?: RelationFilter[];
};

/**
 * server の search / searchWithDeleted / searchForSorting が受ける形: limit は必須(省くと既定で黙って行が落ちるのを型で止める)。
 * HTTP など外から来る limit は resolveSearchLimit(@/lib/crud/server)で既定と上限を当ててから渡す。
 * 行の全部が要る読みは明示の上限と、上限を超えた時の扱いを書く(黙って落とさない)
 */
export type BoundedSearchParams = SearchParams & { limit: number };

export type PaginatedResult<T> = {
  results: T[];
  total: number;
};

/**
 * count() の返り値。
 */
export type CountResult = {
  total: number;
};

/**
 * count() に渡すパラメータ。
 * search() と同じフィルタ条件を受け取るが、ページング・ソート関連は不要。
 */
export type CountParams = {
  searchQuery?: string;
  searchFields?: string[];
  where?: WhereExpr;
  /**
   * リレーション経由のフィルタリング（belongsToMany / belongsTo 両対応）。
   * Drizzle 専用（Firestore では無視される）。
   */
  relationWhere?: RelationFilter[];
};
