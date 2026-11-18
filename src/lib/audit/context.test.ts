// src/lib/audit/context.test.ts
// 監査の文脈(AsyncLocalStorage)の入れ子のテスト。実行: pnpm test src/lib/audit (node:test)
// 入口が包む形(リクエスト = routeFactory、pnpm task = runner、予定の cron = lib/cron の route)で、内側で
// もう一度包んでも安全であること(内側の文脈は内側だけ、抜けると外側に戻る)を確かめる
import { test } from "node:test";
import assert from "node:assert/strict";

import { getAuditContext, runAsSystem, runWithAuditContext } from "./context";

const user = { actorId: "u1", actorType: "user" as const, ip: null, userAgent: null, sessionId: null, requestId: "req-outer" };

test("包む前は文脈が無い、runAsSystem の中は system", async () => {
  assert.equal(getAuditContext(), null);
  const inside = await runAsSystem(() => getAuditContext(), { requestId: "r1" });
  assert.equal(inside?.actorType, "system");
  assert.equal(inside?.requestId, "r1");
  assert.equal(getAuditContext(), null);
});

test("入れ子: 内側の runAsSystem は内側だけで効き、抜けると外側の文脈に戻る", async () => {
  const seen = await runWithAuditContext(user, async () => {
    const before = getAuditContext()?.actorId;
    const inner = await runAsSystem(async () => {
      await new Promise((resolve) => setTimeout(resolve, 1));
      return getAuditContext();
    }, { requestId: "req-inner" });
    const after = getAuditContext();
    return { before, inner, after };
  });
  assert.equal(seen.before, "u1");
  assert.equal(seen.inner?.actorType, "system");
  assert.equal(seen.inner?.requestId, "req-inner");
  assert.equal(seen.after?.actorId, "u1");
  assert.equal(seen.after?.requestId, "req-outer");
});

test("並べて走る 2 つの文脈は混ざらない", async () => {
  const [a, b] = await Promise.all([
    runAsSystem(async () => {
      await new Promise((resolve) => setTimeout(resolve, 5));
      return getAuditContext()?.requestId;
    }, { requestId: "a" }),
    runWithAuditContext(user, async () => {
      await new Promise((resolve) => setTimeout(resolve, 1));
      return getAuditContext()?.requestId;
    }),
  ]);
  assert.equal(a, "a");
  assert.equal(b, "req-outer");
});
