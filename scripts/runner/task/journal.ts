// scripts/runner/task/journal.ts
// git に入れない移行(.local.ts)の本実行の後に、作業の記録の下書きを docs/journal/ に書く(コミットはしない。人が書き足してコミットする)。
// ファイル名 = <YYYY-MM-DD>--<fork_id>--local-migration-<ドメイン>-<名前>.md(日付は日本時間。同じ名前があれば -2, -3 … を付けて上書きしない)。
// 書式: docs/journal/README.md。利用者: scripts/runner/task/run.ts

import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

import { readForkIdentity } from "../../../src/lib/forkOwnership/forkIds.mjs";

export type JournalRun = {
  runId: string;
  name: string;
  status: string;
  args: string[];
  file: string;
  fileHash: string;
  source: string;
  result?: unknown;
  error?: string;
  actor: string;
  stage: string;
  dbTarget: string | null;
  gitSha: string | null;
  startedAt: Date;
};

/** 日本時間の YYYY-MM-DD */
export const journalDate = (at: Date): string => new Date(at.getTime() + 9 * 3600 * 1000).toISOString().slice(0, 10);

/** 下書きの本文 */
export function journalBody(owner: string, run: JournalRun): string {
  const outcome = run.error ? `error: ${run.error}` : JSON.stringify(run.result ?? null, null, 2);
  return [
    `# git に入れない移行 ${run.name}(${journalDate(run.startedAt)})`,
    "",
    `> owner: ${owner}`,
    "",
    "## 実行",
    "",
    `- 実行の記録: task_runs.id = \`${run.runId}\`(status ${run.status})`,
    `- ファイル: \`${run.file}\`(sha256 ${run.fileHash}、git に入れない)`,
    `- 引数: \`${run.args.join(" ") || "(なし)"}\``,
    `- 実行者 ${run.actor} / 段階 ${run.stage} / 接続先 ${run.dbTarget ?? "(不明)"} / git ${run.gitSha ?? "(不明)"}`,
    "",
    "## 結果",
    "",
    "```",
    outcome,
    "```",
    "",
    "## なぜ・確かめたこと",
    "",
    "<!-- 人が書く: 何が起きて、なぜこの修正が要ったか / dry-run の結果をどう確かめたか / 下流にも同じ問題があり得るか(あれば .local を外して notice を付け、普通の移行にする) -->",
    "",
    "## 中身(実行した全文)",
    "",
    "```ts",
    run.source.trimEnd(),
    "```",
    "",
  ].join("\n");
}

/** 下書きを書いてリポジトリ直下からの相対パスを返す */
export function writeJournalDraft(repoRoot: string, run: JournalRun): string {
  const owner = readForkIdentity(repoRoot).own ?? "unknown";
  const [domain, local] = run.name.split(":");
  const base = `${journalDate(run.startedAt)}--${owner}--local-migration-${domain}-${local}`;
  const dir = path.join(repoRoot, "docs/journal");
  mkdirSync(dir, { recursive: true });
  let file = `${base}.md`;
  for (let n = 2; existsSync(path.join(dir, file)); n += 1) file = `${base}-${n}.md`;
  writeFileSync(path.join(dir, file), journalBody(owner, run));
  return `docs/journal/${file}`;
}
