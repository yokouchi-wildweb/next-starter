// src/lib/cron/createCronRoute.test.mts
// cron の route が handler を監査の system の文脈で走らせること(D211: 入口が包む)。実行: pnpm test src/lib/cron (node:test)
import { after, mock, test } from "node:test";
import assert from "node:assert/strict";

import { setAppEnv } from "@/lib/appEnv";
import { getAuditContext } from "@/lib/audit/server";

import nextServer from "next/server";

// 入口の芯は最初に next/server の connection() を待つ。Next のリクエストの外(ここ)では throw するので、
// next/server は本物のまま connection だけ空にする(入口を読み込む前に置く)
mock.module("next/server", { namedExports: { ...nextServer, connection: async () => {} } });
const { createCronRoute } = await import("./createCronRoute.ts");

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

test("失敗の記録の口があればそこへ渡し(タスク名・requestId・durationMs・道)、JSON の error 行は出さない", async () => {
  const reported: { error: unknown; input: Record<string, unknown> }[] = [];
  const route = createCronRoute(
    { name: "report-throw", handler: async () => { throw new Error("boom"); } },
    { onServerError: async (error, input) => void reported.push({ error, input }) },
  );
  const original = console.error;
  const lines: unknown[] = [];
  console.error = (...args: unknown[]) => void lines.push(args);
  try {
    const res = await route(new Request("http://localhost/api/cron/report-throw?x=1"));
    assert.equal(res.status, 500);
    assert.deepEqual(await res.json(), { ok: false, error: "boom" });
  } finally {
    console.error = original;
  }
  assert.equal(lines.length, 0);
  assert.equal(reported.length, 1);
  assert.equal((reported[0].error as Error).message, "boom");
  assert.equal(reported[0].input.name, "report-throw");
  assert.equal(reported[0].input.path, "/api/cron/report-throw");
  assert.equal(typeof reported[0].input.requestId, "string");
  assert.equal(typeof reported[0].input.durationMs, "number");
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

test("メンテナンスの期間は本体を呼ばずに skipped(reason maintenance)、pass の宣言は走る、口が無ければ今の通り", async () => {
  let ran = 0;
  const handler = async () => {
    ran += 1;
    return {};
  };
  const active = { maintenance: { isActive: async () => true } };
  const original = console.log;
  console.log = () => {};
  try {
    const skipped = await createCronRoute({ name: "m-skip", handler }, active)(new Request("http://localhost/api/cron/m-skip"));
    assert.equal(skipped.status, 200);
    assert.deepEqual(await skipped.json(), { ok: true, skipped: true, reason: "maintenance" });
    assert.equal(ran, 0);

    const passed = await createCronRoute({ name: "m-pass", handler, maintenance: "pass" }, active)(
      new Request("http://localhost/api/cron/m-pass"),
    );
    assert.equal((await passed.json()).skipped, undefined);
    assert.equal(ran, 1);

    await createCronRoute({ name: "m-none", handler })(new Request("http://localhost/api/cron/m-none"));
    assert.equal(ran, 2);
  } finally {
    console.log = original;
  }
});

test("閉じた・無効のタスクではメンテナンスの期間を読まない", async () => {
  let reads = 0;
  const deps = {
    gate: { isClosed: (pathname: string) => pathname.endsWith("/m-closed") },
    maintenance: {
      isActive: async () => {
        reads += 1;
        return true;
      },
    },
  };
  const handler = async () => ({});
  const original = console.log;
  console.log = () => {};
  try {
    const closed = await createCronRoute({ name: "m-closed", handler }, deps)(new Request("http://localhost/api/cron/m-closed"));
    assert.equal((await closed.json()).reason, "closed");
    const disabled = await createCronRoute({ name: "m-disabled", handler, enabled: () => false }, deps)(
      new Request("http://localhost/api/cron/m-disabled"),
    );
    assert.equal((await disabled.json()).reason, "disabled");
  } finally {
    console.log = original;
  }
  assert.equal(reads, 0);
});
