// src/lib/crud/drizzle/service/table.ts
// 表そのものの群: truncateAll / getTruncateAffectedTables / getTableName / getIdColumnName

import { db } from "@/lib/drizzle";
import { sql, getTableName } from "drizzle-orm";
import type { PgTable, AnyPgColumn } from "drizzle-orm/pg-core";
import type { ServiceContext } from "./context";

export function createTableMethods<TTable extends PgTable & { id: AnyPgColumn }, TCreate extends Record<string, any>>(ctx: ServiceContext<TTable, TCreate>) {
  const { table, idColumn, belongsToManyRelations } = ctx;
  return {
    /**
     * テーブルの全データを物理削除する（TRUNCATE CASCADE）
     * belongsToMany中間テーブルも削除対象となる
     *
     * @returns 削除されたテーブル名の配列（メインテーブル + 中間テーブル）
     */
    async truncateAll(): Promise<string[]> {
      const truncatedTables: string[] = [];
      const mainTableName = getTableName(table);

      // 中間テーブル + メインテーブルを1クエリでTRUNCATE
      const throughTableNames = belongsToManyRelations.map((relation) =>
        getTableName(relation.throughTable),
      );
      const allTableNames = [...throughTableNames, mainTableName];
      const quotedNames = allTableNames.map((name) => `"${name}"`).join(", ");
      await db.execute(sql.raw(`TRUNCATE TABLE ${quotedNames} CASCADE`));
      truncatedTables.push(...allTableNames);

      return truncatedTables;
    },
    /**
     * TRUNCATE CASCADE実行時に影響を受けるテーブル一覧を取得する
     * （実際の削除は行わない）
     *
     * @returns 影響を受けるテーブル名の配列
     */
    async getTruncateAffectedTables(): Promise<string[]> {
      const mainTableName = getTableName(table);

      // PostgreSQLのシステムカタログから外部キー参照を取得
      const result = await db.execute(sql`
        SELECT DISTINCT
          tc.table_name as referencing_table
        FROM information_schema.table_constraints tc
        JOIN information_schema.constraint_column_usage ccu
          ON tc.constraint_name = ccu.constraint_name
          AND tc.table_schema = ccu.table_schema
        WHERE tc.constraint_type = 'FOREIGN KEY'
          AND ccu.table_name = ${mainTableName}
          AND tc.table_schema = 'public'
      `) as { referencing_table: string }[];

      const affectedTables: string[] = [mainTableName];

      // belongsToMany中間テーブルを追加
      for (const relation of belongsToManyRelations) {
        const throughTableName = getTableName(relation.throughTable);
        if (!affectedTables.includes(throughTableName)) {
          affectedTables.push(throughTableName);
        }
      }

      // 外部キーで参照しているテーブルを追加
      for (const row of result) {
        if (!affectedTables.includes(row.referencing_table)) {
          affectedTables.push(row.referencing_table);
        }
      }

      return affectedTables;
    },
    /**
     * テーブル名（物理名）を取得する
     */
    getTableName(): string {
      return getTableName(table);
    },
    /**
     * 主キー列の物理名を取得する（論理名は常に CRUD_ID_FIELD = "id"。表そのものは公開しない）
     */
    getIdColumnName(): string {
      return idColumn.name;
    },
  };
}
