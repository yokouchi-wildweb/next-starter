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

import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

import { resolveImport } from "../../../../eslint-rules/resolve-import.mjs";
import { readDistrictMapAt } from "../../../../src/lib/districtMap/node.mjs";
import { FEATURES_DIR } from "../../registry/tableScan.mjs";
import { valueSpecifiers } from "../pureImports.mjs";
import { scanSettingSectionFeatures } from "./gateSettingPaths.mjs";

const FEATURES_FIELD = /(?:^|[{,\s])features\s*:\s*\[([\s\S]*?)\]/;
const TABLES_FIELD = /(?:^|[{,\s])tables\s*:/;
const DOMAIN_API_PATHS_FIELD = /(?:^|[{,\s])(domainApiPaths|settingPaths|cronPaths)\s*:/;
/** cron の task の住所の手書き(pathPatterns の中の "/api/cron/…")。task の import から導く(目録 D10) */
const HANDWRITTEN_CRON_PATH = /["'`]\/api\/cron\/[^"'`]*["'`]/;
/** cron の task の置き場と、import を数えるファイル(task.ts と fork の task.override.ts。src/lib/cron/discover.ts と同じ名前) */
const CRON_ROUTE_DIR = "src/app/api/cron";
const CRON_TASK_FILES = ["task.ts", "task.override.ts"];
const STRING_LITERAL = /^["']([A-Za-z0-9_/-]+)["']$/;

/**
 * 規則ファイルの features: [...] を字面で読む(文字列リテラルの配列だけ)
 * @returns {{ features: string[] } | { problem: string }}
 */
export function readFeatures(text) {
  if (TABLES_FIELD.test(text)) return { problem: "tables を手書きしている(features: [機能のフォルダ] で書く。表名は生成器が導く)" };
  if (HANDWRITTEN_CRON_PATH.test(text)) return { problem: "pathPatterns に cron の住所 /api/cron/… を手書きしている(cron の門は task.ts の import から生成器が導く。消して pnpm generate extensions)" };
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
 * cron の task ごとに、値で import するファイル(リポジトリ相対)を集める。task.ts と task.override.ts の静的・動的 import(型だけは数えない)を
 * 構文木で読み(pureImports.mjs の valueSpecifiers。依存の検査と同じ数え方)、resolveImport で解く。深さ 1(task のファイルが直に読む物だけ)
 * @param {string} repoRoot
 * @returns {{ path: string, targets: string[] }[]} path = /api/cron/<名>
 */
export function scanCronTaskImports(repoRoot) {
  const root = join(repoRoot, CRON_ROUTE_DIR);
  if (!existsSync(root)) return [];
  const tasks = [];
  for (const entry of readdirSync(root, { withFileTypes: true }).filter((e) => e.isDirectory()).sort((a, b) => (a.name < b.name ? -1 : 1))) {
    const targets = new Set();
    for (const name of CRON_TASK_FILES) {
      const file = join(root, entry.name, name);
      if (!existsSync(file)) continue;
      for (const source of valueSpecifiers(file, readFileSync(file, "utf8"))) {
        const resolved = resolveImport(source, file, repoRoot);
        if (resolved) targets.add(resolved);
      }
    }
    tasks.push({ path: `/api/cron/${entry.name}`, targets: [...targets] });
  }
  return tasks;
}

/**
 * 変換を作る(表の走査は 1 回だけ)
 * @param {string} repoRoot
 * @returns {{ problems: string[], apply: (label: string, text: string, name: string) => { fields: { tables: string[], domainApiPaths: string[], settingPaths: string[], cronPaths: string[] }, features: string[] } | { problem: string }, unknownFeatures: (ruleNames: string[]) => string[] }}
 */
export function createFeatureTables(repoRoot) {
  const map = readDistrictMapAt(repoRoot);
  // 規則の features は src/features からの相対("core/<d>" か "<d>")
  const districtOf = new Map(map.districts.filter((d) => d.kind === "features").map((d) => [d.dir.slice(FEATURES_DIR.length + 1), d]));
  const sections = scanSettingSectionFeatures(repoRoot);
  const cronTasks = scanCronTaskImports(repoRoot);
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
      // cron の門(目録 D10): features のフォルダを値で import する task の住所。task が複数の規則のフォルダを読めば、その全部の規則が住所を持つ
      // (= 実行してよいのは関係する規則の enabled の論理積)。features のフォルダを読まない task は常時開
      const prefixes = read.features.map((folder) => `${FEATURES_DIR}/${folder}`);
      const cronPaths = cronTasks
        .filter((task) => task.targets.some((target) => prefixes.some((prefix) => target === prefix || target.startsWith(`${prefix}/`))))
        .map((task) => task.path);
      return { fields: { tables, domainApiPaths, settingPaths: sections.pathsOf(name), cronPaths }, features: read.features };
    },
  };
}
