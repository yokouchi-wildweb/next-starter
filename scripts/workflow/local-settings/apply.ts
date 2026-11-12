// scripts/workflow/local-settings/apply.ts
//
// pnpm workflow local-settings apply [--no-grant] [--drop-deny=<行>…] [--bypass] [--json]
// plan が見せたとおりに書く: 控え(<チェックアウト>/.agent/)→ 手元の設定の全面書き換え →(--bypass)個人設定の 2 項目。
// 確認はスキル /local-settings が取る(この命令は聞かない)。
// 終了コード: 0 = 書いた / 2 = 設定が読めない・引数の誤り(何も書かない、1 行で理由)
// 規則と使い方: scripts/workflow/local-settings/README.md

import { applyPlan, parseOptions, resolvePaths, runAction } from "./lib";

runAction((args) => {
  const options = parseOptions(args);
  const applied = applyPlan(resolvePaths(), options);
  if (options.json) {
    console.log(JSON.stringify(applied, null, 2));
    return;
  }
  console.log(`手元の設定を書き換えました: ${applied.localFile}`);
  console.log(`控え: ${applied.localBackup ?? "(前のファイルは無かった)"}`);
  if (options.bypass) {
    console.log(applied.userFile ? `個人設定の 2 項目を書きました: ${applied.userFile}(控え: ${applied.userBackup ?? "前のファイルは無かった"})。次の起動から効く` : "個人設定: 変わる項目なし");
  }
});
