// scripts/registry/tableScan.mjs
// src/features 配下の pgTable を字面で走査し、表名 → 定義ファイルと、機能のフォルダ → 表名の対応を返す。
// Node 組み込みだけで動く .mjs(表の定義ファイルは import しない = drizzle・DB の依存を読み込まない)。
//
// 使い手: scripts/extensions/derive/featureTables.mjs(機能を閉じる規則の features → tables の導出、D16・D20 K1)、
//         scripts/registry/tableScan.test.mjs(走査の集合 = schemaRegistry の全表、pnpm test:schema-registry)。
//         計画書 04 の registry:generate(schemaRegistry を走査で丸ごと生成、親 D67)も同じ関数を使う前提の形。
//
// 走査の範囲: src/features/** の .ts(*.test.* を除く)。entities/drizzle.ts の外(entities/notificationRead.ts、
// userProfile/generated/<role>/drizzle.ts などの生成物)も拾う。
// 字面で読めない pgTable(名前を変数・定数で渡す)は problems に場所を出す(走査の漏れを黙って通さない)。
// コメントの中(JSDoc の使用例など)は見ない。

import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, relative, sep } from "node:path";

export const FEATURES_DIR = "src/features";

const PG_TABLE_CALL = /\bpgTable\s*\(/g;
const PG_TABLE_LITERAL = /^\s*["'`]([A-Za-z0-9_]+)["'`]/;

/** コメントを空白に(位置は保たない。JSDoc の使用例 `pgTable("x", …)` を拾わないため)。文字列中の // は URL 程度なので気にしない */
const stripComments = (text) => text.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/(^|[^:"'`])\/\/.*$/gm, "$1");

function walk(dir, out = []) {
  if (!existsSync(dir)) return out;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else if (entry.isFile() && /\.tsx?$/.test(entry.name) && !/\.test\./.test(entry.name)) out.push(full);
  }
  return out;
}

/**
 * src/features の pgTable を集める
 * @param {string} repoRoot
 * @returns {{ tables: { name: string, file: string }[], problems: string[] }} file はリポジトリ相対(/ 区切り)
 */
export function scanFeatureTables(repoRoot) {
  const tables = [];
  const problems = [];
  for (const abs of walk(join(repoRoot, FEATURES_DIR)).sort()) {
    const file = relative(repoRoot, abs).split(sep).join("/");
    const text = stripComments(readFileSync(abs, "utf8"));
    for (const match of text.matchAll(PG_TABLE_CALL)) {
      // import 文の中の pgTable(呼び出しでない)は ( が続かないので当たらない
      const rest = text.slice(match.index + match[0].length);
      const literal = PG_TABLE_LITERAL.exec(rest);
      if (literal) tables.push({ name: literal[1], file });
      else problems.push(`${file}: pgTable の表名が文字列リテラルでない(走査で読めない)`);
    }
  }
  return { tables, problems };
}

/**
 * 機能のフォルダ(src/features からの相対、例 "core/wallet"・"sample")の表名を返す。フォルダの下の全ファイルが対象
 * @param {{ name: string, file: string }[]} tables scanFeatureTables の結果
 * @param {string} folder
 * @returns {string[]} 表名(定義ファイル → 出現順)
 */
export function tablesOfFolder(tables, folder) {
  const prefix = `${FEATURES_DIR}/${folder.replace(/\/+$/, "")}/`;
  return tables.filter((table) => table.file.startsWith(prefix)).map((table) => table.name);
}
