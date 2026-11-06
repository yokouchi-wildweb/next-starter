// fork の基準の版(台帳の最後の upstream:<sha>)と、その版のファイル一覧を読む。
// 公開の入口: notice の隣の codemod(.notices/<id>.<名前>.mjs)はここから読む。道具どうしで import し合わない
// (notice の本文と一緒に道具を消したとき、別の道具が壊れないように)。
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { lastUpstreamSha } from "./check.mjs";
import { readForkIdentity } from "./forkIds.mjs";

export { lastUpstreamSha };

/**
 * 基準の版のファイル(台帳 .notices/applied/<fork_id>.md の最後の upstream:<sha>、base で上書き)
 * @param {string} root リポジトリのルート
 * @param {string | null | undefined} base 基準の版(--base <rev>)。無ければ台帳から決める
 * @returns {{ rev: string, files: string[] } | { problem: string }}
 */
export function readBaseFiles(root, base) {
  let rev = base;
  if (!rev) {
    const { own } = readForkIdentity(root);
    const ledger = own ? join(root, ".notices/applied", `${own}.md`) : null;
    rev = ledger && existsSync(ledger) ? lastUpstreamSha(readFileSync(ledger, "utf8")) : null;
    if (!rev) return { problem: "基準の版が決まらない(.claude/rules/project.md の fork_id: と台帳の upstream:<sha> を確かめるか --base <rev> を渡す)" };
  }
  try {
    const out = execFileSync("git", ["ls-tree", "-r", "--name-only", rev], { cwd: root, encoding: "utf8", maxBuffer: 256 * 1024 * 1024 });
    return { rev, files: out.split("\n").filter(Boolean) };
  } catch {
    return { problem: `基準の版 ${rev} を読めない(git の履歴に無い)` };
  }
}
