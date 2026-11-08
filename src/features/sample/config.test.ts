// src/features/sample/config.test.ts
// サンプルのドメインの閉じる値(enabled)が上書きで効き、門番の規則 sampleDomain がそれを読むことのテスト。実行: pnpm test src/features/sample (node:test)
import { test } from "node:test";
import assert from "node:assert/strict";

import { rule } from "@/featureGate/rules/sampleDomain";

import { SAMPLE_CONFIG, sampleConfigDef } from "./config";

test("上流の空の上書き(src/config/features/sample.config.ts)では既定の開のまま", () => {
  assert.deepEqual(SAMPLE_CONFIG, { enabled: true });
  assert.equal(rule.enabled(), true);
});

test("上書き { enabled: false } で閉じる値になる", () => {
  assert.deepEqual(sampleConfigDef.compose({ enabled: false }), { enabled: false });
});
