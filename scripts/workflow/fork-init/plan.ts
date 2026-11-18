// scripts/workflow/fork-init/plan.ts
//
// pnpm workflow fork-init plan --answers=<path> [--no-push] [--json]
// 答えのファイルを確かめ、apply が書く物を手順ごとに見せる(何も書かない)。スキル /fork-init はこれを承認の材料に出す。
// 終了コード: 0 = 見せた / 1 = 答えの誤り・前提の不足(理由を全部)
// 規則と使い方: scripts/workflow/fork-init/README.md

import { formatPlan, parseOptions, planRows, prepare, runAction } from "./lib";

runAction((args) => {
  const options = parseOptions(args);
  const root = process.cwd();
  const rows = planRows(root, prepare(root, options));
  if (options.json) console.log(JSON.stringify(rows, null, 2));
  else console.log(`fork-init の計画(済みの手順は飛ばす):\n${formatPlan(rows)}`);
});
