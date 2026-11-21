// src/lib/crud/types/apiClient.ts
// HTTP の CRUD client(createApiClient)の形

import type { CountParams, CountResult, PaginatedResult, SearchParams, WhereExpr } from "./query";
import type { WithOptions } from "./relations";
import type { BulkRelationResult, BulkUpdateRecord, BulkUpdateResult, BulkUpsertOptions, BulkUpsertResult, DuplicateOptions, ReplaceByQueryOptions, UpsertOptions } from "./write";

export type ApiClient<T, CreateData = Partial<T>, UpdateData = Partial<T>> = {
  getAll(options?: WithOptions): Promise<T[]>;
  get(id: string, options?: WithOptions): Promise<T>;
  create(data: CreateData): Promise<T>;
  update(id: string, data: UpdateData): Promise<T>;
  delete(id: string): Promise<void>;
  search?(params: SearchParams & WithOptions): Promise<PaginatedResult<T>>;
  bulkDeleteByIds?(ids: string[]): Promise<void>;
  bulkDeleteByQuery?(where: WhereExpr): Promise<void>;
  /**
   * where 一致行の全削除と records の挿入を単一トランザクションで行う（Drizzle のみ）。
   */
  replaceByQuery?(
    where: WhereExpr,
    records: CreateData[],
    options?: ReplaceByQueryOptions,
  ): Promise<T[]>;
  upsert?(data: CreateData, options?: UpsertOptions<CreateData>): Promise<T>;
  bulkUpsert?(records: CreateData[], options?: BulkUpsertOptions<CreateData>): Promise<BulkUpsertResult<T>>;
  bulkUpdate?(records: BulkUpdateRecord<UpdateData>[]): Promise<BulkUpdateResult<T>>;
  bulkUpdateByIds?(ids: string[], data: UpdateData): Promise<{ count: number }>;
  /** 複数レコードに同じ関連先を足す（belongsToMany。Drizzle のみ）。既存の関連は残す */
  bulkAddRelation?(field: string, ids: string[], targetIds: string[]): Promise<BulkRelationResult>;
  /** 複数レコードから指定の関連先だけを外す（belongsToMany。Drizzle のみ） */
  bulkRemoveRelation?(field: string, ids: string[], targetIds: string[]): Promise<BulkRelationResult>;
  duplicate?(id: string, options?: DuplicateOptions): Promise<T>;
  // ソフトデリート用メソッド
  restore?(id: string): Promise<T>;
  hardDelete?(id: string): Promise<void>;
  getAllWithDeleted?(options?: WithOptions): Promise<T[]>;
  getWithDeleted?(id: string, options?: WithOptions): Promise<T>;
  searchWithDeleted?(params: SearchParams & WithOptions): Promise<PaginatedResult<T>>;
  // 並び替え用メソッド
  reorder?(id: string, afterItemId: string | null): Promise<T>;
  /**
   * ソート画面用検索。sort_order が NULL のレコードを自動初期化する。
   */
  searchForSorting?(params: SearchParams): Promise<PaginatedResult<T>>;
  /**
   * フィルタ条件に一致するレコード件数を取得する。
   */
  count?(params: CountParams): Promise<CountResult>;
};
