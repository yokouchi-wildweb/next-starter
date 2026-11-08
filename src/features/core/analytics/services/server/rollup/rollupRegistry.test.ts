// src/features/core/analytics/services/server/rollup/rollupRegistry.test.ts
//
// ロールアップの登録の振り分けの検査(DB なし)。
// - enabled 省略 = 有効、enabled() が false = 無効の key に入り active に出ない
// - key の重複は無効の項目も含めて例外
// 実行: pnpm test src/features/core/analytics/services/server/rollup/rollupRegistry.test.ts
// (package.json に type: module が無いので tsx は CJS として読む → before() で import)
import { before, test } from "node:test";
import assert from "node:assert/strict";
import type { RollupMetricConfig } from "./types";

let buildRollupRegistry: typeof import("./rollupRegistry").buildRollupRegistry;
before(async () => {
  ({ buildRollupRegistry } = await import("./rollupRegistry"));
});

const metric = (key: string, enabled?: () => boolean): RollupMetricConfig => ({
  key,
  kind: "flow",
  compute: async () => [],
  ...(enabled ? { enabled } : {}),
});

test("enabled 省略 = 有効(今までどおり)", () => {
  const { active, disabledKeys } = buildRollupRegistry([metric("a.x"), metric("b.y")]);
  assert.deepEqual([...active.keys()], ["a.x", "b.y"]);
  assert.equal(disabledKeys.size, 0);
});

test("enabled() が false の項目は active から外れ、無効の key に入る", () => {
  const { active, disabledKeys } = buildRollupRegistry([
    metric("a.x", () => false),
    metric("b.y", () => true),
    metric("c.z"),
  ]);
  assert.deepEqual([...active.keys()], ["b.y", "c.z"]);
  assert.deepEqual([...disabledKeys], ["a.x"]);
});

test("key の重複は無効の項目も含めて例外", () => {
  assert.throws(() => buildRollupRegistry([metric("a.x"), metric("a.x")]), /a\.x/);
  assert.throws(() => buildRollupRegistry([metric("a.x", () => false), metric("a.x")]), /a\.x/);
});
