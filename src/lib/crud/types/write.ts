// src/lib/crud/types/write.ts
// 書き込み系の操作(upsert・一括・置き換え・複製)のオプションと結果

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
 * replaceByQuery のオプション。
 */
export type ReplaceByQueryOptions = {
  /**
   * true の場合、sortOrderColumn 設定済みサービスで挿入 records の配列順に
   * fractional sort key を自動採番する（records 内の明示値より優先）。
   * sortOrderColumn 未設定のサービスで指定すると throw（fail-fast）。
   */
  sortOrderFromIndex?: boolean;
};

/**
 * バルクアップデート用のレコード型。
 * idと更新データをセットで渡す。
 */
export type BulkUpdateRecord<UpdateData> = {
  id: string;
  data: UpdateData;
};

/** bulkAddRelation / bulkRemoveRelation の結果。存在しない id はエラーにせず飛ばして返す */
export type BulkRelationResult = {
  /** 実際に増減した中間テーブルの行数（再追加・もともと無い行の削除は数えない） */
  count: number;
  /** 実際に増減があったレコードの id */
  affectedIds: string[];
  unknownIds: string[];
  unknownTargetIds: string[];
};

export type BulkUpdateResult<T> = {
  /** 更新されたレコード一覧 */
  results: T[];
  /** 更新されたレコード数 */
  count: number;
  /** 存在しなかったID一覧 */
  notFoundIds: string[];
};

/**
 * duplicate のオプション。
 */
export type DuplicateOptions = {
  /**
   * 複製後レコードの name。
   * 未指定時は複製元の name に「_コピー」を付与する（従来動作）。
   * 複製元に string 型の name フィールドがない場合は無視される。
   */
  name?: string;
};
