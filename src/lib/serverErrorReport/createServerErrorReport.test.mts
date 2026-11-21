// src/lib/serverErrorReport/createServerErrorReport.test.mts
// 既定の 1 行が必ず先に書かれ、項目の throw・遅れ・読み込みの失敗が他を止めないこと。実行: pnpm test src/lib/serverErrorReport (node:test)
import { test } from "node:test";
import assert from "node:assert/strict";

import { createServerErrorReport } from "./createServerErrorReport.ts";
import type { ServerErrorReporter, ServerErrorReporterLoader } from "./types.ts";

const request = { path: "/mypage?token=secret#x", method: "GET", headers: { cookie: "__session=abc" } };
const context = {
  routerKind: "App Router" as const,
  routePath: "/mypage",
  routeType: "render" as const,
  renderSource: "react-server-components" as const,
  revalidateReason: undefined,
};

function setup(items: ServerErrorReporter[], extra: ServerErrorReporterLoader[] = [], runtime: "nodejs" | "edge" = "nodejs") {
  const lines: Record<string, unknown>[] = [];
  const loaders = [...items.map((item) => ({ name: item.name, load: async () => item })), ...extra];
  const report = createServerErrorReport(loaders, {
    runtime,
    timeoutMs: 50,
    registerTimeoutMs: 50,
    write: (line) => lines.push(JSON.parse(line)),
  });
  return { report, lines };
}

test("既定の 1 行: クエリ・headers・cookie を書かず、項目より先", async () => {
  const order: string[] = [];
  const { report, lines } = setup([
    { name: "a", onRequestError: () => void order.push(`a:${lines.length}`) },
  ]);
  const error = Object.assign(new Error("boom"), { digest: "123" });
  await report.onRequestError(error, request, context);
  assert.equal(lines.length, 1);
  const line = lines[0];
  assert.equal(line.level, "error");
  assert.equal(line.scope, "request");
  assert.equal(line.path, "/mypage");
  assert.equal(line.digest, "123");
  assert.equal((line.error as { message: string }).message, "boom");
  assert.ok(!JSON.stringify(line).includes("secret"));
  assert.ok(!JSON.stringify(line).includes("__session"));
  assert.deepEqual(order, ["a:1"]);
});

test("項目の throw・遅れ・読み込みの失敗は別の 1 行で、他の項目は届く", async () => {
  const got: string[] = [];
  const { report, lines } = setup(
    [
      { name: "throws", onRequestError: () => { throw new Error("reporter down"); } },
      { name: "hangs", onRequestError: () => new Promise(() => {}) },
      { name: "ok", onRequestError: (error) => void got.push((error as Error).message) },
    ],
    [{ name: "broken", load: async () => { throw new Error("cannot load"); } }],
  );
  await report.onRequestError(new Error("boom"), request, context);
  assert.deepEqual(got, ["boom"]);
  assert.equal(lines[0].scope, "request");
  const fails = lines.filter((l) => l.scope === "serverErrorReport").map((l) => `${l.reporter}:${l.phase}`).sort();
  assert.deepEqual(fails, ["broken:load", "hangs:onRequestError", "throws:onRequestError"]);
  assert.equal(lines.find((l) => l.reporter === "hangs")?.reason, "timeout");
});

test("循環・BigInt・Error でない値でも throw しない", async () => {
  const { report, lines } = setup([]);
  const cyclic: Record<string, unknown> = { n: 1n };
  cyclic.self = cyclic;
  await report.onRequestError(cyclic, request, context);
  await report.report(Object.assign(new Error("x"), { extra: cyclic }), { scope: "api", path: "/api/x?q=1", method: "POST" });
  assert.equal(lines.length, 2);
  assert.equal((lines[0].error as { name: string }).name, "NonError");
  assert.equal(lines[1].scope, "api");
  assert.equal(lines[1].path, "/api/x");
  assert.equal(lines[1].routeType, "route");
});

test("書き手が throw しても onRequestError は throw しない", async () => {
  const report = createServerErrorReport([], {
    runtime: "nodejs",
    timeoutMs: 50,
    registerTimeoutMs: 50,
    write: () => { throw new Error("stdout closed"); },
  });
  await report.onRequestError(new Error("boom"), request, context);
});

test("runtime: 既定 nodejs の項目は edge で呼ばれない、both は両方", async () => {
  const got: string[] = [];
  const items: ServerErrorReporter[] = [
    { name: "node", onRequestError: () => void got.push("node") },
    { name: "both", runtime: "both", onRequestError: () => void got.push("both") },
    { name: "edge", runtime: "edge", onRequestError: () => void got.push("edge") },
  ];
  await setup(items, [], "edge").report.onRequestError(new Error("e"), request, context);
  assert.deepEqual(got.sort(), ["both", "edge"]);
});

test("register: 項目ごとに独立、遅れと throw は別の 1 行", async () => {
  let ran = 0;
  const { report, lines } = setup([
    { name: "slow", register: () => new Promise(() => {}) },
    { name: "bad", register: () => { throw new Error("init failed"); } },
    { name: "good", register: () => void ran++ },
  ]);
  await report.register();
  assert.equal(ran, 1);
  assert.deepEqual(lines.map((l) => `${l.reporter}:${l.phase}`).sort(), ["bad:register", "slow:register"]);
});

test("report: 入口の失敗も既定の 1 行 + 項目へ(proxy は routeType proxy、名前と requestId)", async () => {
  const seen: unknown[] = [];
  const { report, lines } = setup([{ name: "a", onRequestError: (_e, req, ctx) => void seen.push([req.path, ctx.routeType]) }]);
  await report.report(new Error("cron failed"), { scope: "cron", path: "/api/cron/sweep", method: "GET", name: "sweep", requestId: "r1" });
  await report.report(new Error("proxy failed"), { scope: "proxy", path: "/x?y=1", method: "GET" });
  assert.equal(lines[0].name, "sweep");
  assert.equal(lines[0].requestId, "r1");
  assert.equal(lines[1].routeType, "proxy");
  assert.deepEqual(seen, [["/api/cron/sweep", "route"], ["/x", "proxy"]]);
});
