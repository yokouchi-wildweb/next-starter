// scripts/workflow/backend-selection/show.mjs — pnpm workflow backend-selection show
// 選択表・口ごとの選べる名前・選んだ実装の足りない env の名前(値は出さない)を出す。読むだけ。説明: scripts/workflow/backend-selection/README.md
import { BackendSelectionError, runAction, show } from "./lib.mjs";

runAction((args) => {
  if (args.length !== 0) throw new BackendSelectionError("使い方: pnpm workflow backend-selection show");
  for (const line of show(process.cwd())) console.log(line);
});
