// scripts/workflow/fork-init/apply.ts
//
// pnpm workflow fork-init apply --answers=<path> [--no-push] [--json]
// plan が見せたとおり、済みでない手順を確認なしで順に書く(commit と push まで)。何度走らせても同じ結果: 済みの手順は飛ばす。
// 確認はスキル /fork-init が plan で 1 回だけ取る(この命令は聞かない)。
// 終了コード: 0 = 書いた(書く物が無かった時も)/ 1 = 答えの誤り・前提の不足(何も書かない)/ ほか = 途中の手順が失敗(もう一度走らせると残りから)
// 規則と使い方: scripts/workflow/fork-init/README.md

import { applySteps, parseOptions, prepare, runAction } from "./lib";

runAction((args) => {
  const options = parseOptions(args);
  const root = process.cwd();
  const applied = applySteps(root, prepare(root, options));
  if (options.json) console.log(JSON.stringify({ applied }, null, 2));
  else console.log(applied.length ? `fork-init: ${applied.join(" → ")}` : "fork-init: 書く物なし(全部済み)");
});
