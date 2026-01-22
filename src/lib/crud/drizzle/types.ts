// src/lib/crud/drizzle/types.ts

import type { PgTable, AnyPgColumn } from "drizzle-orm/pg-core";
import type {
  CreateCrudServiceOptions,
  BelongsToRelation,
  BelongsToManyObjectRelation,
  CountableRelation,
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
   * withCount オプション用: カウント取得対象のリレーション設定。
   */
  countableRelations?: CountableRelation[];
  /**
   * reorder メソッド用: sortOrder カラム。
   * 設定するとドラッグ&ドロップでの並び替えが可能になる。
   * Fractional Indexing（文字列ベース）を使用。
   */
  sortOrderColumn?: AnyPgColumn;
};
