// ドメインのシードの雛形 <ドメイン>/seed.ts(write-once: 無いときだけ書き、既にあれば触らない。書き方: src/lib/seed/README.md)。
// 行は空の配列で出し、列の名前と $unique の行の例をコメントで添える(値は人が書く)。Firestore のドメインは表名で引けないので出さない。

import path from "node:path";

import { resolveFieldName } from "../../domain/fieldName.mjs";
import { domainTableName } from "../../domain/names.mjs";
import { writeOnce } from "../output.mjs";

/** 雛形の本文 */
export function seedTemplate(ctx) {
  const { camel, snake, config, dbEngine } = ctx;
  const table = domainTableName(snake, config);
  const columns = [
    ...(config?.fields ?? []).filter((f) => f.formInput !== "none").map((f) => resolveFieldName(f.name, dbEngine)),
    ...(config?.relations ?? []).filter((r) => r.relationType === "belongsTo" || r.relationType === "belongsToMany").map((r) => resolveFieldName(r.fieldName, dbEngine)),
  ];
  const first = columns[0] ?? "name";
  const rel = ctx.rel ?? `src/features/${camel}`;
  return [
    `// ${rel}/seed.ts — ${camel} のシード(pnpm ops db seed、書き方: src/lib/seed/README.md)`,
    "// 中身はデータだけ(入れるのは ${camel} のサービス)。関係先は ref(<ドメイン>, <$key>)、そのドメインは after に書く。".replace("${camel}", camel),
    'import "server-only";',
    "",
    'import { defineSeed } from "@/lib/seed";',
    "",
    "export const seed = defineSeed({",
    '  // after: ["<先に入れるドメイン>"],',
    "  tables: {",
    `    ${table}: [`,
    `      // 列: ${columns.join(", ") || "(なし)"}`,
    `      // 例(何度打っても同じにするなら $unique に探す列を書く): { $key: "example1", $unique: ["${first}"], ${first}: "…" },`,
    "    ],",
    "  },",
    "});",
    "",
  ].join("\n");
}

/** @returns {import("../output.mjs").Output[]} */
export function renderSeed(ctx) {
  if (ctx.dbEngine === "Firestore") return [];
  return [
    writeOnce(path.join(ctx.dir, "seed.ts"), seedTemplate(ctx), {
      label: "シードの雛形を生成しました",
      keptLabel: "既存のため生成しません（書き捨て）",
    }),
  ];
}
