// scripts/workflow/devcheck/danger.ts
//
// pnpm workflow devcheck danger <dbp|evp|dep>
// 危険な種類に今できることを出す(読むだけ)。off = 人に頼む 1 行 / manual で許可なし = /allow が要る / 許可あり = 打つ命令。
// エージェントは許可の後にこれを打ち、出た命令をそのまま打ち、結果を 1 行で報告する(/allow スキル)
// 終了コード: 0 = 打つ命令を出した / 2 = 危険な種類のスイッチ名でない / 4 = 打てない(理由の 1 行)
// 規則と使い方: scripts/workflow/devcheck/README.md「方針」

import { runDanger } from "./lib.allow.mjs";
import { checkoutRoot, invocationDir } from "../dev-tab/lib";
import { DANGER_NAMES, SWITCHES, offLine, policyKeyOf, readAgentPolicy } from "./lib.kinds.mjs";
import { runAction } from "./lib.facts";

runAction(async (args) => {
  const root = checkoutRoot(invocationDir());
  const result = runDanger(root, args[0] ?? "", await readAgentPolicy(root), { SWITCHES, DANGER_NAMES, offLine, policyKeyOf });
  for (const line of result.lines) console.log(line);
  return result.code;
});
