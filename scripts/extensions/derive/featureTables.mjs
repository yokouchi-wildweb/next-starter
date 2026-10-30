// scripts/extensions/derive/featureTables.mjs
// 組み込みの変換 "featureTables": 機能を閉じる規則の features: [機能のフォルダ] から、そのフォルダの全 pgTable の表名を導く(D16・D20 K1)。
// 規則のファイルは字面で読むだけ(import しない = 表定義を proxy の束に載せない)。表の走査: scripts/registry/tableScan.mjs
// 一覧の項目は `{ ...rule, tables: [...] }` になる(型 GatedFeatureRule)。

import { existsSync } from "node:fs";
import { join } from "node:path";

import { FEATURES_DIR, scanFeatureTables, tablesOfFolder } from "../../registry/tableScan.mjs";

const FEATURES_FIELD = /(?:^|[{,\s])features\s*:\s*\[([\s\S]*?)\]/;
const TABLES_FIELD = /(?:^|[{,\s])tables\s*:/;
const STRING_LITERAL = /^["']([A-Za-z0-9_/-]+)["']$/;

/**
 * 規則ファイルの features: [...] を字面で読む(文字列リテラルの配列だけ)
 * @returns {{ features: string[] } | { problem: string }}
 */
export function readFeatures(text) {
  if (TABLES_FIELD.test(text)) return { problem: "tables を手書きしている(features: [機能のフォルダ] で書く。表名は生成器が導く)" };
  const match = FEATURES_FIELD.exec(text);
  if (!match) return /\bfeatures\s*:/.test(text) ? { problem: "features が文字列リテラルの配列でない" } : { features: [] };
  const features = [];
  for (const part of match[1].split(",").map((p) => p.trim()).filter(Boolean)) {
    const literal = STRING_LITERAL.exec(part);
    if (!literal) return { problem: `features の要素 ${part} が文字列リテラルでない(フォルダ名を "core/wallet" の形で直接書く)` };
    features.push(literal[1]);
  }
  return { features };
}

/**
 * 変換を作る(表の走査は 1 回だけ)
 * @param {string} repoRoot
 * @returns {{ problems: string[], apply: (label: string, text: string) => { fields: { tables: string[] }, features: string[] } | { problem: string } }}
 */
export function createFeatureTables(repoRoot) {
  const scan = scanFeatureTables(repoRoot);
  return {
    problems: scan.problems,
    apply(label, text) {
      const read = readFeatures(text);
      if (read.problem) return { problem: `${label}: ${read.problem}` };
      const tables = [];
      for (const folder of read.features) {
        if (!existsSync(join(repoRoot, FEATURES_DIR, folder))) return { problem: `${label}: features の "${folder}" は ${FEATURES_DIR}/ に無いフォルダ` };
        const own = tablesOfFolder(scan.tables, folder);
        if (own.length === 0) return { problem: `${label}: features の "${folder}" に pgTable が無い(表を持たない機能は features に書かない)` };
        tables.push(...own);
      }
      return { fields: { tables }, features: read.features };
    },
  };
}
