// scripts/registry/schemaGate.ts
//
// スキーマゲート: feature-gate.config.ts で enabled=false の機能のテーブルを push 対象から外す。
// pnpm db:push（push.ts）と pnpm db:push:check（check-schema-roundtrip.ts）が共通で使う。
//
// 外し方（両側から外すのが要点。片側だけだと事故になる）:
// - コード側: pushSchema に渡す imports から該当 pgTable を除く → 未作成なら作られない
// - DB 側:   tablesFilter（"!<table>"）で introspection から除く → 既存でも DROP されない
// - enum は外さない（コード側から消すと DROP TYPE が出る。空の型が残るだけで無害）
//
// 詳細: src/proxies/README.md

import { getTableName, is } from "drizzle-orm";
import { getTableConfig, PgTable } from "drizzle-orm/pg-core";

import type { FeatureGateRule } from "@/config/app/feature-gate.config";

export type SchemaGateResult = {
  /** pushSchema の第 1 引数（ゲート対象テーブルを除いた schemaRegistry の export） */
  imports: Record<string, unknown>;
  /** pushSchema の第 4 引数。ゲート対象が無いときは undefined（= 全テーブル） */
  tablesFilter: string[] | undefined;
  /** 今回 push 対象から外したテーブル名 */
  gatedTables: string[];
};

/**
 * schemaRegistry の export とゲート定義から、push に渡す入力を組み立てる。
 * 定義の誤り（存在しないテーブル名 / 外すテーブルを残すテーブルが外部キーで参照）は例外にする。
 */
export function applySchemaGate(schema: Record<string, unknown>, rules: FeatureGateRule[]): SchemaGateResult {
  const tables = Object.values(schema).filter((value): value is PgTable => is(value, PgTable));
  const tableNames = new Set(tables.map((table) => getTableName(table)));

  const gated = new Set(rules.filter((rule) => !rule.enabled).flatMap((rule) => rule.tables ?? []));
  const unknown = [...gated].filter((name) => !tableNames.has(name));
  if (unknown.length > 0) {
    throw new Error(
      `feature-gate.config.ts の tables に schemaRegistry に無いテーブル名があります: ${unknown.join(", ")}`,
    );
  }

  const kept = tables.filter((table) => !gated.has(getTableName(table)));
  const brokenReferences = kept.flatMap((table) =>
    getTableConfig(table)
      .foreignKeys.map((fk) => getTableName(fk.reference().foreignTable))
      .filter((target) => gated.has(target))
      .map((target) => `${getTableName(table)} → ${target}`),
  );
  if (brokenReferences.length > 0) {
    throw new Error(
      "無効な機能のテーブルを、有効な機能のテーブルが外部キーで参照しています（機能フラグの組み合わせを見直してください）: " +
        brokenReferences.join(", "),
    );
  }

  const imports = Object.fromEntries(
    Object.entries(schema).filter(([, value]) => !(is(value, PgTable) && gated.has(getTableName(value)))),
  );

  return {
    imports,
    tablesFilter: gated.size > 0 ? [...gated].map((name) => `!${name}`) : undefined,
    gatedTables: [...gated],
  };
}
