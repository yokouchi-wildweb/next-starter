// scripts/structure/extensions/derive/featureTables.mjs
// 組み込みの変換 "featureTables": 機能を閉じる規則の features: [機能のフォルダ] から、そのフォルダの全 pgTable の表名を導く(D16・D20 K1)。
// features に書けるのはドメインの位置にあるフォルダ(src/features/core/<名前> か src/features/<名前>。CLAUDE.md DOMAINS)。
// 表の数は問わない(0 = Firestore のドメインなど、tables: [] になる)。無いフォルダ・ドメインの位置でない書き方(深い場所・core そのもの)は止める。
// 規則のファイルは字面で読むだけ(import しない = 表定義を proxy の束に載せない)。ドメインの有無・表・汎用 API のキーは地区の地図の読み手
// src/lib/districtMap の features の地区(dir・tables・apiKeys)から読む(目録 D1・D2)
// 一覧の項目は `{ ...rule, name: "<ファイル名>", tables: [...], domainApiPaths: [...] }` になり(型 GatedFeatureRule)、生成一覧は名前の union FeatureName も出す(name は extensions.mjs が付ける)。
// 汎用 API の住所: features の各フォルダの services/server/domainEntry.ts の domainEntries のキー(地区の apiKeys)から /api/<key> を導き、
// 項目の pathPatterns に足す(`[...rule.pathPatterns, ...]`)。
// domainEntry の無いフォルダは何も足さない。規則に手書きした同じ住所は pnpm test src/featureGate scripts/structure/proxies が重なりとして知らせる。
// 設定の節の住所: 節の feature(規則名)から /admin/settings/<key> を導き settingPaths として同じく足す(./gateSettingPaths.mjs、L1.17)。

import { existsSync } from "node:fs";
import { join } from "node:path";

import { readDistrictMapAt } from "../../../../src/lib/districtMap/node.mjs";
import { FEATURES_DIR } from "../../registry/tableScan.mjs";
import { scanSettingSectionFeatures } from "./gateSettingPaths.mjs";

const FEATURES_FIELD = /(?:^|[{,\s])features\s*:\s*\[([\s\S]*?)\]/;
const TABLES_FIELD = /(?:^|[{,\s])tables\s*:/;
const DOMAIN_API_PATHS_FIELD = /(?:^|[{,\s])(domainApiPaths|settingPaths)\s*:/;
const STRING_LITERAL = /^["']([A-Za-z0-9_/-]+)["']$/;

/**
 * 規則ファイルの features: [...] を字面で読む(文字列リテラルの配列だけ)
 * @returns {{ features: string[] } | { problem: string }}
 */
export function readFeatures(text) {
  if (TABLES_FIELD.test(text)) return { problem: "tables を手書きしている(features: [機能のフォルダ] で書く。表名は生成器が導く)" };
  const derivedField = DOMAIN_API_PATHS_FIELD.exec(text)?.[1];
  if (derivedField) return { problem: `${derivedField} を手書きしている(汎用 API の住所は features のフォルダの domainEntry.ts、設定の節の住所は節の feature から生成器が導く)` };
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
 * @returns {{ problems: string[], apply: (label: string, text: string, name: string) => { fields: { tables: string[], domainApiPaths: string[], settingPaths: string[] }, features: string[] } | { problem: string }, unknownFeatures: (ruleNames: string[]) => string[] }}
 */
export function createFeatureTables(repoRoot) {
  const map = readDistrictMapAt(repoRoot);
  // 規則の features は src/features からの相対("core/<d>" か "<d>")
  const districtOf = new Map(map.districts.filter((d) => d.kind === "features").map((d) => [d.dir.slice(FEATURES_DIR.length + 1), d]));
  const sections = scanSettingSectionFeatures(repoRoot);
  return {
    problems: [...map.tableProblems, ...sections.problems],
    unknownFeatures: sections.unknownFeatures,
    apply(label, text, name) {
      const read = readFeatures(text);
      if (read.problem) return { problem: `${label}: ${read.problem}` };
      const tables = [];
      const domainApiPaths = [];
      for (const folder of read.features) {
        const district = districtOf.get(folder);
        if (!district) {
          if (!existsSync(join(repoRoot, FEATURES_DIR, folder))) return { problem: `${label}: features の "${folder}" は ${FEATURES_DIR}/ に無いフォルダ` };
          return { problem: `${label}: features の "${folder}" はドメインの位置でない(${FEATURES_DIR}/core/<名前> か ${FEATURES_DIR}/<名前> の _ で始まらないフォルダを書く)` };
        }
        // 表は 0 でもよい(表を持たないドメインは tables: [] のまま、住所は下で導く)
        tables.push(...district.tables);
        const entryProblem = map.problems.find((problem) => problem.startsWith(`${district.dir}/services/server/domainEntry.ts: `));
        if (entryProblem) return { problem: `${label}: ${entryProblem}` };
        const paths = district.apiKeys.map((key) => `/api/${key}`);
        domainApiPaths.push(...paths.filter((path) => !domainApiPaths.includes(path)));
      }
      return { fields: { tables, domainApiPaths, settingPaths: sections.pathsOf(name) }, features: read.features };
    },
  };
}
