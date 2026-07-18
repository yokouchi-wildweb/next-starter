// src/lib/crud/drizzle/types.ts

import type { SQL } from "drizzle-orm";
import type { PgTable, AnyPgColumn } from "drizzle-orm/pg-core";
import type { AuditRecorder } from "@/lib/audit";
import type {
  CreateCrudServiceOptions,
  BelongsToRelation,
  BelongsToManyObjectRelation,
  CountableRelation,
  HasManyRelation,
} from "@/lib/crud/types";
import type { db } from "@/lib/drizzle";

/**
 * Drizzle トランザクション型。
 * db.transaction() のコールバック引数から推論。
 */
export type DbTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

/**
 * db または tx のどちらでも使える実行コンテキスト型。
 */
export type DbExecutor = typeof db | DbTransaction;

export type BelongsToManyRelationConfig<TData extends Record<string, any>> = {
  /**
   * ドメインエンティティ上で利用するフィールド名。
   * e.g. sampleTagIds
   */
  fieldName: Extract<keyof TData, string>;
  /**
   * 中間テーブルそのもの。
   */
  throughTable: PgTable;
  /**
   * 中間テーブルの現ドメインIDカラム。
   */
  sourceColumn: AnyPgColumn;
  /**
   * 中間テーブルの関連ドメインIDカラム。
   */
  targetColumn: AnyPgColumn;
  /**
   * insert 用に利用する現ドメインIDカラム名。
   */
  sourceProperty: string;
  /**
   * insert 用に利用する関連ドメインIDカラム名。
   */
  targetProperty: string;
};

/**
 * Drizzle固有の追加WHERE条件オプション。
 * search / searchWithDeleted で WhereExpr DSL では表現できない
 * Drizzle SQL条件（サブクエリ、EXISTS、JSONB演算子等）を注入する。
 */
export type ExtraWhereOption = {
  extraWhere?: SQL;
};

/**
 * bulk 系操作（bulkDeleteByIds / bulkDeleteByQuery / bulkUpdateByIds / bulkUpdate / bulkUpsert）の
 * 監査ログ記録モード。
 *
 * - "aggregate": 件数 + サンプル ID + 条件スナップショットを 1 行に集約（既定）
 * - "detail":    各レコードに対して個別に記録（個別 select が必要なためコスト大）
 * - "off":       bulk 操作については一切記録しない
 *
 * ドメインの性質に応じて選ぶ。重要データ（user / payment 等）は detail、
 * 大量ログ（analytics 等）は aggregate ないし off を選択する。
 */
export type BulkAuditMode = "aggregate" | "detail" | "off";

/**
 * createCrudService に渡す監査ログ設定。
 *
 * 実体の recorder（auditLogger）は features/core/auditLog 側にあるため、
 * 呼び出し側が DI で渡す（lib→features 違反を回避するため）。
 *
 * - enabled: false の場合は audit hook を一切呼び出さない（性能影響ゼロ）
 * - targetType: audit_logs.target_type に保存される値。ドメイン名と揃える
 * - actionPrefix: action 名の先頭。例: "user" → "user.created" / "user.updated" / "user.deleted"
 * - trackedFields: 差分検出対象の絞り込み。省略時は全フィールド（denylist 適用後）
 * - bulkMode: bulk 操作の記録モード（既定: aggregate）
 * - retentionDays: ログ保持日数（省略時は recorder 既定）
 * - strict:    true（既定）で失敗時 throw、false で dead-letter 退避（best-effort）
 */
export type AuditConfig = {
  enabled: boolean;
  targetType: string;
  actionPrefix: string;
  trackedFields?: readonly string[];
  bulkMode?: BulkAuditMode;
  retentionDays?: number;
  strict?: boolean;
  recorder: AuditRecorder;
};

export type DrizzleCrudServiceOptions<TData extends Record<string, any>> = CreateCrudServiceOptions<TData> & {
  belongsToManyRelations?: Array<BelongsToManyRelationConfig<TData>>;
  /**
   * withRelations オプション用: belongsTo リレーション設定。
   * 外部キーからリレーション先のオブジェクトを取得する。
   */
  belongsToRelations?: BelongsToRelation[];
  /**
   * withRelations オプション用: belongsToMany のオブジェクト展開設定。
   * 中間テーブルを経由してリレーション先のオブジェクト配列を取得する。
   */
  belongsToManyObjectRelations?: BelongsToManyObjectRelation[];
  /**
   * withRelations オプション用: hasMany リレーション設定。
   * 親→子方向のリレーションを展開し、子レコードの配列を取得する。
   */
  hasManyRelations?: HasManyRelation[];
  /**
   * withCount オプション用: カウント取得対象のリレーション設定。
   */
  countableRelations?: CountableRelation[];
  /**
   * reorder メソッド用: sortOrder カラム。
   * 設定するとドラッグ&ドロップでの並び替えが可能になる。
   * Fractional Indexing（文字列ベース）を使用。
   */
  sortOrderColumn?: AnyPgColumn;
  /**
   * 監査ログ設定。指定すると CRUD 操作が自動的に audit_logs に記録される。
   * recorder は features/core/auditLog の `auditLogger` を渡す。
   */
  audit?: AuditConfig;
  /**
   * Storage連携クリーンアップ対象のフィールド名一覧
   * （mediaUploader=単一/string, mediaUploaderMulti=複数/string[] の両方）。
   * 指定すると、レコードが「物理削除」される操作で対象フィールドが参照する
   * Storage 上のファイルを自動削除する（best-effort）。
   * 対象操作:
   * - hardDelete（常に物理削除）
   * - remove / bulkDeleteByIds / bulkDeleteByQuery（useSoftDelete=false のときのみ物理削除）
   * ソフトデリート（deletedAt 設定）では復元可能性を保つためファイルは保持し、
   * hardDelete 時にのみ削除する。
   * 通常は drizzleBase が `extractStorageFields(conf)` の結果を渡す。
   */
  storageCleanupFields?: string[];
  /**
   * リクエストスコープメモ化（既定: false）。
   * true にすると get(id)（オプションなし呼び出しのみ）が同一サーバーリクエスト内で
   * メモ化され、同じ行の重複クエリが1回に圧縮される。全書き込みメソッドは完了時に
   * メモを自動破棄するため read-your-writes は維持される。
   * createCrudService を経由しない生SQL書き込みをした場合のみ
   * `service.invalidateRequestMemo()` を直後に呼ぶこと。
   * リクエストスコープ外（cron / CLI）では自動的に素通しになる。
   * 対象基準・注意点: src/lib/requestMemo/README.md
   */
  requestMemo?: boolean;
};
