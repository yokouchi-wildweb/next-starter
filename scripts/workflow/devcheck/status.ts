// scripts/workflow/devcheck/status.ts
//
// pnpm workflow devcheck status [--json]
// 今の状態だけを出す(この作業場所のサーバー・動いている dev-tab の数と上限・管理者)。何も書かない。
// 終了コード: 0 = 出した / 2 = DEVCHECK_CONTEXT が読めない(1 行で理由)
// 規則と使い方: scripts/workflow/devcheck/README.md

import { formatState } from "./lib";
import { gatherFacts, runAction } from "./lib.facts";

runAction(async (args) => {
  const json = args.includes("--json");
  const facts = await gatherFacts();
  console.log(json ? JSON.stringify({ context: facts.context, state: facts.state }, null, 2) : formatState(facts.state, facts.context).join("\n"));
});
