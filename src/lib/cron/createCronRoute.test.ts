// src/lib/cron/createCronRoute.test.ts
// cron の route が handler を監査の system の文脈で走らせること(D211: 入口が包む)。実行: pnpm test src/lib/cron (node:test)
import { after, test } from "node:test";
import assert from "node:assert/strict";

import { setAppEnv } from "@/lib/appEnv";
import { getAuditContext } from "@/lib/audit";

import { createCronRoute } from "./createCronRoute";

// 認証を通す(段階 development、src/lib/cron/auth.ts)
const restoreAppEnv = setAppEnv("development");
after(restoreAppEnv);

test("handler は system の文脈の中で走り、応答とログに同じ requestId", async () => {
  const seen: { ctx: ReturnType<typeof getAuditContext> } = { ctx: null };
  const route = createCronRoute({
    name: "audit-context-probe",
    handler: async () => {
      seen.ctx = getAuditContext();
      return { probed: true };
    },
  });
  const logs: string[] = [];
  const original = console.log;
  console.log = (line: string) => logs.push(line);
  try {
    const res = await route(new Request("http://localhost/api/cron/audit-context-probe"));
    const body = await res.json();
    assert.equal(res.status, 200);
    assert.equal(body.probed, true);
  } finally {
    console.log = original;
  }
  assert.equal(seen.ctx?.actorType, "system");
  const log = JSON.parse(logs.find((line) => line.includes("audit-context-probe")) ?? "{}");
  assert.equal(log.requestId, seen.ctx?.requestId);
  assert.equal(getAuditContext(), null);
});

test("handler が投げても 500 で返し、文脈は外に漏れない", async () => {
  const route = createCronRoute({ name: "audit-context-throw", handler: async () => { throw new Error("boom"); } });
  const original = console.error;
  console.error = () => {};
  try {
    const res = await route(new Request("http://localhost/api/cron/audit-context-throw"));
    assert.equal(res.status, 500);
  } finally {
    console.error = original;
  }
  assert.equal(getAuditContext(), null);
});
