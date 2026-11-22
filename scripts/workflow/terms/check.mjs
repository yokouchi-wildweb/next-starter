// scripts/workflow/terms/check.mjs — 段階 ship の検査(phase.json): 語の表(terms.json)の必ず誤りの言い換えを、Tier1 の文脈ファイルと Tier1 の道具で止める
// 実行: pnpm check terms [-- --json]
// - Tier1(repo.json の tier root): 見る所の全部 / fork(root でない): Tier1 の版(台帳の最後の upstream:<sha>)にあるパスだけ(fork の業務の語は見ない)
// - exit 0 = 当たり 0 / 1 = 当たりあり(「パス:行 誤り → 正しい語」)/ 2 = 確かめられない(fork で基準の版が読めない。通過ではない)

import { join } from "node:path";

import { readBaseFiles } from "../../../src/lib/forkOwnership/baseFiles.mjs";
import { readForkIdentity } from "../../../src/lib/forkOwnership/forkIds.mjs";

import { scan } from "./lib.terms.mjs";

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
if (json) console.log(JSON.stringify({ scope: only ? "tier1-files" : "all", hits }, null, 2));
else {
  for (const h of hits) console.log(`${h.path}:${h.line}  ${h.found} → ${h.say}(${h.decisions.join("・")})`);
  console.log(`terms: ${hits.length ? `誤りの言い換え ${hits.length} 件(語の表 scripts/workflow/terms/terms.json)` : "誤りの言い換え 0 件"}${only ? "(Tier1 の版にあるファイルだけ)" : ""}`);
}
process.exitCode = hits.length ? 1 : 0;
