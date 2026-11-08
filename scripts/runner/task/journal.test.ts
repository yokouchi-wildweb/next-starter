// scripts/runner/task/journal.test.ts — pnpm test scripts/runner/task/journal.test.ts
// git に入れない移行の作業の記録の下書き(journal.ts): ファイル名・owner の行・本文の欄・上書きしないこと。
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";

import { journalDate, writeJournalDraft } from "./journal";

const RUN = {
  runId: "run-1",
  name: "wallet:fix-rows",
  status: "succeeded",
  args: ["--all"],
  file: "src/features/core/wallet/scripts/migrations/fix-rows.local.ts",
  fileHash: "abc",
  source: "export const task = {};\n",
  result: { fixed: 3 },
  actor: "me@host",
  stage: "development",
  dbTarget: "db.example/app",
  gitSha: "deadbeef",
  startedAt: new Date("2026-11-08T16:30:00Z"),
};

test("日付は日本時間、owner は fork_id、同じ名前があれば -2 を付けて上書きしない、本文に記録の id・全文・人が書く欄", () => {
  const root = mkdtempSync(path.join(tmpdir(), "journal-"));
  try {
    mkdirSync(path.join(root, ".claude/rules"), { recursive: true });
    writeFileSync(path.join(root, ".claude/rules/project.md"), "fork_id: shop\ndownstream: none\n");
    assert.equal(journalDate(RUN.startedAt), "2026-11-09");
    const first = writeJournalDraft(root, RUN);
    assert.equal(first, "docs/journal/2026-11-09--shop--local-migration-wallet-fix-rows.md");
    assert.equal(writeJournalDraft(root, RUN), "docs/journal/2026-11-09--shop--local-migration-wallet-fix-rows-2.md");
    const body = readFileSync(path.join(root, first), "utf8");
    assert.match(body, /^# git に入れない移行 wallet:fix-rows/);
    assert.match(body, /\n> owner: shop\n/);
    assert.match(body, /task_runs\.id = `run-1`/);
    assert.match(body, /"fixed": 3/);
    assert.match(body, /## なぜ・確かめたこと/);
    assert.match(body, /```ts\nexport const task = \{\};\n```/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
