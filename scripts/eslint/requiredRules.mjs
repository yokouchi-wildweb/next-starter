// scripts/eslint/requiredRules.mjs
//
// 全 Tier の必須の ESLint 規則(eslint-rules/required-rules.mjs)が、fork の eslint.config.fork.mjs を最後に読んだ
// 最終の設定でも error のままかを確かめる。pnpm eslint:required(pnpm build から呼ぶ)。
// 失敗: 規則が off / warn になっている・規則が設定に無い・代表のファイルが無い(example: true の行を除く)。
// fork が規則を足す・一覧の外を緩めるのは止めない。

import { existsSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";

import { ESLint } from "eslint";

import { REQUIRED_ESLINT_RULES } from "../../eslint-rules/required-rules.mjs";

const ERROR = 2;

/** 規則の値(数・名前・[強さ, …options])→ 0 / 1 / 2。設定に無ければ null */
export function severityOf(value) {
  if (value === undefined) return null;
  const raw = Array.isArray(value) ? value[0] : value;
  if (raw === "error") return 2;
  if (raw === "warn") return 1;
  if (raw === "off") return 0;
  return typeof raw === "number" ? raw : null;
}

/**
 * 一覧の規則が代表のファイルに error で掛かっているかを調べる
 * @param {{ calculateConfigForFile: (path: string) => Promise<{ rules?: Record<string, unknown> } | undefined> }} eslint
 * @param {typeof REQUIRED_ESLINT_RULES} list
 * @param {string} repoRoot
 * @returns {Promise<{ rule: string, file: string, problem: string }[]>}
 */
export async function checkRequiredRules(eslint, list, repoRoot) {
  const problems = [];
  for (const { rule, files, example } of list) {
    for (const file of files) {
      if (!example && !existsSync(join(repoRoot, file))) {
        problems.push({ rule, file, problem: "代表のファイルが無い(一覧の files を今あるファイルに直す)" });
        continue;
      }
      const config = await eslint.calculateConfigForFile(join(repoRoot, file));
      const severity = severityOf(config?.rules?.[rule]);
      if (severity === null) problems.push({ rule, file, problem: "規則が掛かっていない(設定から消えた・files から外れた)" });
      else if (severity !== ERROR) problems.push({ rule, file, problem: `強さが ${severity === 1 ? "warn" : "off"}(error が必須)` });
    }
  }
  return problems;
}

async function main() {
  const repoRoot = process.cwd();
  const eslint = new ESLint({ cwd: repoRoot });
  const problems = await checkRequiredRules(eslint, REQUIRED_ESLINT_RULES, repoRoot);
  const fileCount = REQUIRED_ESLINT_RULES.reduce((n, entry) => n + entry.files.length, 0);
  if (problems.length === 0) {
    console.log(`[eslint:required] OK(規則 ${REQUIRED_ESLINT_RULES.length} / ファイル ${fileCount})`);
    return;
  }
  console.error("[eslint:required] 全 Tier の必須の ESLint 規則が error ではありません(eslint-rules/required-rules.mjs):");
  for (const { rule, file, problem } of problems) console.error(`  - ${rule} @ ${file}: ${problem}`);
  console.error("  fork の eslint.config.fork.mjs でこの規則を off / warn にしていないか確かめてください。行ごとの例外は理由付きの eslint-disable で。");
  process.exit(1);
}

if (process.argv[1] && relative(process.argv[1], fileURLToPath(import.meta.url)) === "") {
  await main();
}
