// scripts/workflow/repo-json/set.mjs — pnpm workflow repo-json set <鍵> <値>
// 1 つの鍵を書く(読み手の決まりで確かめ、1 鍵 1 行の形で書き直す)。true / false は真偽値、ほかは文字列。
// 終了コード: 0 = 書いた / 2 = 鍵・値・今のファイルの誤り(何も書かない)。説明: scripts/workflow/repo-json/README.md
import { RepoJsonError, runAction, setValue } from "./lib.mjs";

runAction((args) => {
  if (args.length !== 2) throw new RepoJsonError("使い方: pnpm workflow repo-json set <鍵> <値>");
  const [key, raw] = args;
  const values = setValue(process.cwd(), key, raw);
  console.log(`repo.json: ${key} = ${JSON.stringify(values[key])}`);
});
