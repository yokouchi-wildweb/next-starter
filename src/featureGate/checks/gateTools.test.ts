// src/featureGate/checks/gateTools.test.ts
// gate の束の道具の回帰テスト(D23): gate.enabled は規則名で引けて規則の enabled() を返し、未知の名前は型で落ち実行時は throw。
// gate.path は一覧の順で最初の閉じた規則を返す。型の検査は pnpm typecheck(@ts-expect-error の行)、実行は pnpm test:feature-gate:tools

import assert from "node:assert/strict";
import { test } from "node:test";

import { gate, type FeatureName } from "@/featureGate";
import { rules } from "@/featureGate/node";
import { matchesPath } from "@/lib/pathPattern/index.mjs";

test("gate.enabled: 規則のファイル名で引け、規則の enabled() の答えを返す", () => {
  assert.ok(rules.length > 0);
  for (const rule of rules) assert.equal(gate.enabled(rule.name), rule.enabled());
  const wallet: FeatureName = "wallet";
  assert.equal(typeof gate.enabled(wallet), "boolean");
});

test("gate.enabled: 未知の名前は型で落ち、実行時は throw", () => {
  // @ts-expect-error 規則の無い名前は FeatureName に無い
  assert.throws(() => gate.enabled("noSuchFeature"), /未知の機能の名前 "noSuchFeature"/);
  assert.throws(() => gate.enabled("constructor" as FeatureName), /未知の機能の名前/);
});

test("gate.path: 閉じた規則の住所なら一覧の順で最初の閉じた規則の名前と redirectTo、開いていれば open:true", () => {
  for (const rule of rules.filter((r) => !r.enabled())) {
    for (const pattern of rule.pathPatterns) {
      const pathname = pattern.replace(/^=/, "");
      const first = rules.find((r) => !r.enabled() && r.pathPatterns.some((p) => matchesPath(pathname, p)));
      assert.deepEqual(gate.path(pathname), { open: false, rule: first?.name, redirectTo: first?.redirectTo });
    }
  }
  assert.deepEqual(gate.path("/__no_such_gated_path__"), { open: true });
});
