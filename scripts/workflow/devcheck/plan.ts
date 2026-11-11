// scripts/workflow/devcheck/plan.ts
//
// pnpm workflow devcheck plan [--json]
// 開発中の確かめの事実(方針・fork の項目・文脈・今の状態)と候補を出す。最後の候補はいつも片付け。何も書かない。
// 終了コード: 0 = 出した / 2 = 方針・項目のファイルや DEVCHECK_CONTEXT が読めない(1 行で理由)
// 規則と使い方: scripts/workflow/devcheck/README.md

import { buildPlan, formatPlan } from "./lib";
import { gatherFacts, runAction } from "./lib.facts";

runAction(async (json) => {
  const plan = buildPlan(await gatherFacts());
  console.log(json ? JSON.stringify(plan, null, 2) : formatPlan(plan));
});
