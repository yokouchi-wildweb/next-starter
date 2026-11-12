// scripts/workflow/local-settings/plan.ts
//
// pnpm workflow local-settings plan [--no-grant] [--drop-deny=<行>…] [--bypass] [--json]
// 手元の設定(<チェックアウト>/.claude/settings.local.json)の消える行と新しい中身、--bypass なら個人設定の変わる 2 項目を出す。何も書かない。
// 終了コード: 0 = 出した / 2 = 設定が読めない・引数の誤り(1 行で理由)
// 規則と使い方: scripts/workflow/local-settings/README.md

import { buildPlan, formatPlan, parseOptions, resolvePaths, runAction } from "./lib";

runAction((args) => {
  const options = parseOptions(args);
  const plan = buildPlan(resolvePaths(), options);
  console.log(options.json ? JSON.stringify(plan, null, 2) : formatPlan(plan, options));
});
