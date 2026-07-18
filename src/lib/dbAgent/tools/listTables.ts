// src/lib/dbAgent/tools/listTables.ts
//
// list_tables: public スキーマのテーブル一覧 (名前・サイズ・行数目安)。
// scripts/db (db:tables) の挙動をミラーし、行数目安 (reltuples) を追加している。

import type { AgentToolDefinition } from "@/lib/ai";

import { getReadonlyDb } from "../readonlyDb";
import { safeJsonStringify } from "./shared";

export const listTablesTool: AgentToolDefinition = {
  name: "list_tables",
  label: "テーブル一覧の取得",
  description:
    "データベース (public スキーマ) の全テーブルの一覧を取得する。テーブル名・合計サイズ・推定行数を返す。調査の最初にどんなテーブルがあるか把握するために使う。",
  inputSchema: {
    type: "object",
    properties: {},
    required: [],
  },
  summarizeInput: () => "全テーブル",
  async run() {
    const sql = getReadonlyDb();

    const rows = await sql`
      SELECT t.table_name AS "table",
             pg_size_pretty(pg_total_relation_size(quote_ident(t.table_name))) AS "size",
             GREATEST(c.reltuples, 0)::bigint AS "approxRows"
      FROM information_schema.tables t
      LEFT JOIN pg_class c
        ON c.relname = t.table_name
       AND c.relnamespace = 'public'::regnamespace
      WHERE t.table_schema = 'public'
        AND t.table_type = 'BASE TABLE'
      ORDER BY t.table_name
    `;

    return {
      content: safeJsonStringify(rows),
      summary: `${rows.length} テーブル`,
      meta: { tableCount: rows.length },
    };
  },
};
