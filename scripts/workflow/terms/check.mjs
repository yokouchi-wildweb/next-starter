// scripts/workflow/terms/check.mjs — 段階 ship の検査(phase.json): 語の表(terms.json)の必ず誤りの言い換えを、Tier1 の文脈ファイルと Tier1 の道具で止める
// 実行: pnpm check terms [-- --json]
// - Tier1(repo.json の tier root): 見る所の全部 / fork(root でない): Tier1 の版(台帳の最後の upstream:<sha>)にあるパスだけ(fork の業務の語は見ない)
// - 表から描いた .claude/rules/core/terms.md が正本と食い違えば止める(pnpm generate terms で作り直す)
// - exit 0 = 当たり 0 / 1 = 当たりあり(「パス:行 誤り → 正しい語」)か terms.md が古い / 2 = 確かめられない(fork で基準の版が読めない。通過ではない)

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { readBaseFiles } from "../../../src/lib/forkOwnership/baseFiles.mjs";
import { readForkIdentity } from "../../../src/lib/forkOwnership/forkIds.mjs";

import { renderTermsMd, scan, TERMS_FILE, TERMS_MD } from "./lib.terms.mjs";

const root = join(import.meta.dirname, "../../..");
const json = process.argv.includes("--json");

let only = null;
const { tier } = readForkIdentity(root);
if (tier !== "root") {
  const base = readBaseFiles(root);
  if (base.problem) {
    console.log(`terms: 確かめられない — ${base.problem}`);
    process.exit(2);
  }
  only = new Set(base.files);
}

const hits = scan(root, only);
const mdPath = join(root, TERMS_MD);
const stale = !existsSync(mdPath) || readFileSync(mdPath, "utf8") !== renderTermsMd(JSON.parse(readFileSync(join(root, TERMS_FILE), "utf8")));
if (json) console.log(JSON.stringify({ scope: only ? "tier1-files" : "all", hits, termsMdStale: stale }, null, 2));
else {
  for (const h of hits) console.log(`${h.path}:${h.line}  ${h.found} → ${h.say}(${h.decisions.join("・")})`);
  if (stale) console.log(`${TERMS_MD} が正本 ${TERMS_FILE} と食い違う → pnpm generate terms`);
  console.log(`terms: ${hits.length ? `誤りの言い換え ${hits.length} 件(語の表 scripts/workflow/terms/terms.json)` : "誤りの言い換え 0 件"}${only ? "(Tier1 の版にあるファイルだけ)" : ""}`);
}
process.exitCode = hits.length || stale ? 1 : 0;
