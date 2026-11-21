// scripts/workflow/repo-json/unset.mjs — pnpm workflow repo-json unset <鍵>
// 1 つの鍵を消す(set の対。1 鍵 1 行の形で書き直す)。repo_id・tier は消せない。無い鍵は何もしない。
// 終了コード: 0 = 消した・無かった / 2 = 鍵・今のファイルの誤り(何も書かない)。説明: scripts/workflow/repo-json/README.md
import { RepoJsonError, runAction, unsetValue } from "./lib.mjs";

runAction((args) => {
  if (args.length !== 1) throw new RepoJsonError("使い方: pnpm workflow repo-json unset <鍵>");
  const [key] = args;
  const { removed } = unsetValue(process.cwd(), key);
  console.log(removed ? `repo.json: ${key} を消した` : `repo.json: ${key} は無い(何もしない)`);
});
