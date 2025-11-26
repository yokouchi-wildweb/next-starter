// src/lib/crud/drizzle/types.ts

import type { PgTable, AnyPgColumn } from "drizzle-orm/pg-core";
import type { CreateCrudServiceOptions } from "@/lib/crud/types";

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
};
