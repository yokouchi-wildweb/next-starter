// src/lib/dbAgent/tools/describeTable.ts
//
// describe_table: テーブル構造 (カラム・インデックス・外部キー) の取得。
// scripts/db (db:describe) の挙動をミラーし、外部キー情報を追加している。

import { z } from "zod";

import type { AgentToolDefinition } from "@/lib/ai";

import { getReadonlyDb } from "../readonlyDb";
import { isValidIdentifier, safeJsonStringify } from "./shared";

const inputSchema = z.object({
  table: z.string(),
});

export const describeTableTool: AgentToolDefinition = {
  name: "describe_table",
  label: "テーブル構造の確認",
  description:
    "指定テーブルの構造 (カラム名・型・NULL可否・デフォルト値・インデックス・外部キー) を取得する。クエリを書く前に必ず対象テーブルの構造を確認すること。",
  inputSchema: {
    type: "object",
    properties: {
      table: {
        type: "string",
        description: "テーブル名 (public スキーマ)",
      },
    },
    required: ["table"],
  },
  summarizeInput: (input) => {
    const parsed = inputSchema.safeParse(input);
    return parsed.success ? parsed.data.table : "(不正な入力)";
  },
  async run(input) {
    const parsed = inputSchema.safeParse(input);
    if (!parsed.success) {
      return {
        content: "入力が不正です。{ table: string } を指定してください。",
        isError: true,
      };
    }
    const table = parsed.data.table;
    if (!isValidIdentifier(table)) {
      return {
        content: `テーブル名が不正です: ${table}`,
        isError: true,
      };
    }

    const sql = getReadonlyDb();

    const exists = await sql`
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = ${table}
    `;
    if (exists.length === 0) {
      return {
        content: `テーブル "${table}" が見つかりません。list_tables で存在するテーブルを確認してください。`,
        isError: true,
      };
    }

    const columns = await sql`
      SELECT column_name AS "column",
             data_type AS "type",
             is_nullable AS "nullable",
             column_default AS "default"
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = ${table}
      ORDER BY ordinal_position
    `;

    const indexes = await sql`
      SELECT indexname AS "index", indexdef AS "definition"
      FROM pg_indexes
      WHERE schemaname = 'public' AND tablename = ${table}
    `;

    const foreignKeys = await sql`
      SELECT kcu.column_name AS "column",
             ccu.table_name AS "referencesTable",
             ccu.column_name AS "referencesColumn"
      FROM information_schema.table_constraints tc
      JOIN information_schema.key_column_usage kcu
        ON tc.constraint_name = kcu.constraint_name
       AND tc.table_schema = kcu.table_schema
      JOIN information_schema.constraint_column_usage ccu
        ON tc.constraint_name = ccu.constraint_name
       AND tc.table_schema = ccu.table_schema
      WHERE tc.constraint_type = 'FOREIGN KEY'
        AND tc.table_schema = 'public'
        AND tc.table_name = ${table}
    `;

    return {
      content: safeJsonStringify({ table, columns, indexes, foreignKeys }),
      summary: `${table}: ${columns.length} カラム`,
      meta: { table, columnCount: columns.length },
    };
  },
};
