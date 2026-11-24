// src/lib/backends/statusTask.test.mts
// 起動時の知らせの項目(createBackendStatusTask)の契約: 口の状態(偽の BackendStatus)を渡し、口ごとに 1 行、投げない、env の値を出さない。実行: pnpm test src/lib/backends/statusTask.test.mts
import assert from "node:assert/strict";
import { test } from "node:test";

import { createBackendStatusTask } from "./statusTask";
import type { BackendStatus } from "./types";

type IsConfigured = BackendStatus["isConfigured"];
const run = (selected: string, status: { isConfigured: IsConfigured }, write?: (line: string) => void) => {
  const lines: string[] = [];
  const task = createBackendStatusTask({ port: "mail", selected, isConfigured: status.isConfigured }, { write: write ?? ((l) => lines.push(l)) });
  task.run();
  return { task, lines: lines.map((l) => JSON.parse(l) as Record<string, unknown>) };
};

test("揃っている: info の 1 行、名前は backends.<口>、runtime nodejs", () => {
  const { task, lines } = run("resend", { isConfigured: () => ({ configured: true }) });
  assert.equal(task.name, "backends.mail");
  assert.equal(task.runtime, "nodejs");
  assert.deepEqual(lines, [{ scope: "backends", port: "mail", selected: "resend", level: "info", configured: true }]);
});

test("足りない: warn の 1 行に名前だけ(値は持たない)", () => {
  process.env.RESEND_API_KEY = "re_secret_value";
  const { lines } = run("resend", { isConfigured: () => ({ configured: false, missing: ["SENDGRID_API_KEY"] }) });
  assert.deepEqual(lines, [{ scope: "backends", port: "mail", selected: "resend", level: "warn", configured: false, missing: ["SENDGRID_API_KEY"] }]);
  assert.ok(!JSON.stringify(lines).includes("re_secret_value"));
  delete process.env.RESEND_API_KEY;
});

test("none: isConfigured を呼ばず info(使わない)", () => {
  let called = false;
  const { lines } = run("none", { isConfigured: () => ((called = true), { configured: false, missing: [] }) });
  assert.equal(called, false);
  assert.deepEqual(lines, [{ scope: "backends", port: "mail", selected: "none", level: "info", configured: false, none: true }]);
});

test("投げない: isConfigured が投げれば warn に誤りの名前だけ、書き手が投げても飲む", () => {
  const boom: { isConfigured: IsConfigured } = {
    isConfigured: () => {
      throw new TypeError("secret detail");
    },
  };
  const { lines } = run("resend", boom);
  assert.deepEqual(lines, [{ scope: "backends", port: "mail", selected: "resend", level: "warn", configured: false, error: "TypeError" }]);
  assert.doesNotThrow(() => run("resend", boom, () => {
    throw new Error("write failed");
  }));
});
