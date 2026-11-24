// scripts/structure/cron/plan.test.ts — repo.json の vercel.plan の値(forkIds.mjs の VERCEL_PLAN_VALUES)が cron のプラン(src/lib/cron の CRON_PLANS)と同じか。
// 実行: pnpm test scripts/structure/cron/plan.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { CRON_PLANS } from "@/lib/cron";
import { VERCEL_PLAN_VALUES, readVercelPlan } from "@/lib/forkOwnership/node.mjs";

test("vercel.plan の値 = cron のプラン", () => {
  assert.deepEqual([...VERCEL_PLAN_VALUES], [...CRON_PLANS]);
});

test("readVercelPlan: 鍵・repo.json が無い = null、値を読む、知らない値は error", (t) => {
  const dir = mkdtempSync(join(tmpdir(), "vercel-plan-"));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  assert.deepEqual(readVercelPlan(dir), { plan: null, error: null });
  const write = (values: Record<string, string>) => writeFileSync(join(dir, "repo.json"), JSON.stringify({ repo_id: "a", tier: "leaf", ...(values["vercel.plan"] ? { vercel: { plan: values["vercel.plan"] } } : {}) }));
  write({});
  assert.deepEqual(readVercelPlan(dir), { plan: null, error: null });
  write({ "vercel.plan": "pro" });
  assert.deepEqual(readVercelPlan(dir), { plan: "pro", error: null });
  write({ "vercel.plan": "enterprise" });
  const bad = readVercelPlan(dir);
  assert.equal(bad.plan, null);
  assert.match(bad.error ?? "", /vercel\.plan の値は hobby \| pro/);
});
