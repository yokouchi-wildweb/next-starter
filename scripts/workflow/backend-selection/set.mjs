// scripts/workflow/backend-selection/set.mjs — pnpm workflow backend-selection set <口> <名前>
// 1 つの口の実装を選んで書き、生成する。知らない口・知らない名前・fake・任意でない口の none は生成器の検査が止め、表は元に戻す。
// 終了コード: 0 = 書いた / 2 = 止めた(何も変えていない)。説明: scripts/workflow/backend-selection/README.md
import { BackendSelectionError, runAction, setSelection } from "./lib.mjs";

runAction((args) => {
  if (args.length !== 2) throw new BackendSelectionError("使い方: pnpm workflow backend-selection set <口> <名前>");
  setSelection(process.cwd(), args[0], args[1]);
});
