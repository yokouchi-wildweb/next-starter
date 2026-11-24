// scripts/workflow/backend-selection/fill.mjs — pnpm workflow backend-selection fill
// 前提を確かめ、選択表に足りない鍵だけを各口の compat(手元の .env・.env.development・.env.production)で書き、生成する(D31)。
// 何度流しても同じ。決められない口は書かずに聞く文と set の命令を出す。最後に本番の env の確かめの行。
// 終了コード: 0 = 足りない鍵が無い / 書いた、2 = 前提・読めない・決められない口が残った。説明: scripts/workflow/backend-selection/README.md
import { BackendSelectionError, fill, runAction } from "./lib.mjs";

runAction((args) => {
  if (args.length !== 0) throw new BackendSelectionError("使い方: pnpm workflow backend-selection fill");
  const { questions } = fill(process.cwd());
  if (questions.length > 0) process.exitCode = 2;
});
