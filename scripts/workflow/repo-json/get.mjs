// scripts/workflow/repo-json/get.mjs — pnpm workflow repo-json get <鍵>
// 1 つの鍵の値を 1 行で出す(無い = 空行と exit 1)。説明: scripts/workflow/repo-json/README.md
import { RepoJsonError, readValues, runAction } from "./lib.mjs";

runAction(([key]) => {
  if (!key) throw new RepoJsonError("使い方: pnpm workflow repo-json get <鍵>");
  const values = readValues(process.cwd());
  if (!(key in values)) {
    console.log("");
    process.exitCode = 1;
    return;
  }
  console.log(String(values[key]));
});
