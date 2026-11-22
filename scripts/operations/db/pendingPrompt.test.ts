// scripts/operations/db/pendingPrompt.test.ts — pnpm test scripts/operations/db/pendingPrompt.test.ts
// pnpm db:push:check の改名の問い: drizzle-kit の問いの出力(色付きの偽物)から対象と改名元を読み、名指す notice の行を出す(DB には繋がない)

import assert from "node:assert/strict";
import { test } from "node:test";

import { findNoticeAnswers, formatPendingPrompt, parsePendingPrompt } from "./lib.pendingPrompt";

const blue = (s: string) => `\u001b[1m\u001b[34m${s}\u001b[39m\u001b[22m`;
const gray = (s: string) => `\u001b[90m${s}\u001b[39m`;

// drizzle-kit 0.31 の ResolveColumnSelect が出す形(カーソル隠し + 問い + 選択肢)
const columnPrompt = [
  "\u001b[?25l",
  `Is ${blue("authored_content")} column in ${blue("message_dispatches")} table created or renamed from another column?`,
  `\u001b[32m❯ \u001b[39m\u001b[32m+\u001b[39m authored_content                      ${gray("create column")}`,
  `  \u001b[33m~\u001b[39m template_content › authored_content ${gray("rename column")}`,
].join("\n");

test("parsePendingPrompt: 列の問いから名前・表・改名元を読む", () => {
  assert.deepEqual(parsePendingPrompt(columnPrompt), {
    entity: "column",
    name: "authored_content",
    table: "message_dispatches",
    renameFrom: ["template_content"],
  });
});

test("parsePendingPrompt: 表などの問い(ResolveSelect)も読む", () => {
  const out = [
    `Is ${blue("public.dispatches")} table created or renamed from another table?`,
    `❯ + public.dispatches                       ${gray("create table")}`,
    `  ~ public.message_dispatches › public.dispatches ${gray("rename table")}`,
  ].join("\n");
  assert.deepEqual(parsePendingPrompt(out), {
    entity: "table",
    name: "public.dispatches",
    renameFrom: ["public.message_dispatches"],
  });
});

test("parsePendingPrompt: 問いのない出力は null", () => {
  assert.equal(parsePendingPrompt("[✓] Pulling schema from database...\n"), null);
});

test("findNoticeAnswers: 名前と表を含む notice の改名の行だけを返し、長い行は名前の前後に縮める", () => {
  const prompt = parsePendingPrompt(columnPrompt);
  assert.ok(prompt);
  const longChange = `change: ${"x".repeat(400)} message_dispatches.template_content is renamed authored_content: ${"y".repeat(400)}`;
  const answers = findNoticeAnswers(prompt, [
    {
      id: "20261114-134752-messaging-send-fields",
      text: [
        longChange,
        "required_actions:",
        "2. DB: the column rename. A DB that has template_content: drizzle-kit asks rename vs create — answer rename.",
        "3. unrelated step",
      ].join("\n"),
    },
    { id: "other", text: "rename something in message_dispatches" },
  ]);
  assert.equal(answers.length, 1);
  assert.equal(answers[0].id, "20261114-134752-messaging-send-fields");
  assert.equal(answers[0].lines.length, 2);
  assert.ok(answers[0].lines[0].startsWith("…") && answers[0].lines[0].includes("template_content"));
  assert.ok(answers[0].lines[0].length < longChange.length);
  assert.ok(answers[0].lines[1].includes("answer rename"));
});

test("formatPendingPrompt: 対象・改名元・notice の行を名指す", () => {
  const prompt = parsePendingPrompt(columnPrompt);
  assert.ok(prompt);
  const text = formatPendingPrompt(prompt, [{ id: "n1", lines: ["answer rename"] }]);
  assert.ok(text.includes("message_dispatches.authored_content"));
  assert.ok(text.includes("改名元の候補: template_content"));
  assert.ok(text.includes(".notices/n1.md"));
  assert.ok(text.includes("answer rename"));
  // 反映(pnpm db:push)で止めた時は、DB は変えていないと言う
  assert.match(formatPendingPrompt(prompt, [], "push"), /反映はここで止めます\(答えは選びません。DB は変更していません\)/);
});
