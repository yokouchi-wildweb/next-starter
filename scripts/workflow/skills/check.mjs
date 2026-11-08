// scripts/workflow/skills/check.mjs — 門 ship の検査(gate.json): .claude/skills の書式(.claude/rules/core/skills.md)
// 実行: pnpm check skills [-- --base <rev>]
//   exit 0 = 通る(fork が足したスキルの警告と例外の一覧の保留は出すだけ)| 1 = 上流のスキルが書式を破る | 2 = 確かめられない(fork の基準の版が読めない)
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { readBaseFiles } from "../../../src/lib/forkOwnership/baseFiles.mjs";
import { readForkIdentity } from "../../../src/lib/forkOwnership/forkIds.mjs";
import { checkAll, parsePending, PENDING_FILE, readSkills, readVocabulary, RULE_FILE, SKILLS_DIR } from "./lib.skillFormat.mjs";

/**
 * 上流のスキルかを決める関数を作る。Tier1 = 全部上流。fork = 基準の版にある SKILL.md が上流、無い物は fork が足した物
 * @returns {{ isUpstream: (name: string) => boolean, label: string } | { problem: string }}
 */
export function resolveUpstream(root, base) {
  const identity = readForkIdentity(root);
  if (identity.errors.length > 0) return { problem: identity.errors.join("\n") };
  if (identity.isTier1 && !base) return { isUpstream: () => true, label: "Tier1(全部上流)" };
  const read = readBaseFiles(root, base);
  if ("problem" in read) return { problem: read.problem };
  const files = new Set(read.files);
  return { isUpstream: (name) => files.has(`${SKILLS_DIR}/${name}/SKILL.md`), label: `基準の版 ${read.rev.slice(0, 8)}` };
}

/**
 * @param {string} root リポジトリ直下
 * @param {{ base?: string | null, log?: (line: string) => void }} [options]
 * @returns {number} exit code
 */
export function runCheck(root, { base = null, log = console.log } = {}) {
  const upstream = resolveUpstream(root, base);
  if ("problem" in upstream) {
    log(`skills: 確かめられない(上流と fork のスキルを分けられない): ${upstream.problem}`);
    return 2;
  }
  const rulePath = join(root, RULE_FILE);
  const vocabulary = existsSync(rulePath) ? readVocabulary(readFileSync(rulePath, "utf8")) : new Set();
  const pendingPath = join(root, PENDING_FILE);
  const pending = existsSync(pendingPath) ? parsePending(readFileSync(pendingPath, "utf8")) : new Set();
  const result = checkAll({ skills: readSkills(root), isUpstream: upstream.isUpstream, pending, vocabulary });

  for (const line of result.warnings) log(`skills: 警告(fork が足したスキル): ${line}`);
  if (result.pending.length > 0) log(`skills: 書き直し待ち(${PENDING_FILE}): ${result.pending.join(", ")}`);
  for (const name of result.passingPending) log(`skills: ${name} は書式を満たしている → ${PENDING_FILE} から外す`);
  for (const line of result.errors) log(`skills: ${line}`);
  if (result.errors.length > 0) {
    log(`skills: 落ちた(${result.errors.length} 件、${upstream.label})。決まり: ${RULE_FILE}`);
    return 1;
  }
  log(`skills: 通る(${upstream.label}、警告 ${result.warnings.length} 件・書き直し待ち ${result.pending.length} 個)`);
  return 0;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const args = process.argv.slice(2);
  const i = args.indexOf("--base");
  const base = i >= 0 ? args[i + 1] : null;
  process.exitCode = runCheck(join(import.meta.dirname, "../../.."), { base });
}
