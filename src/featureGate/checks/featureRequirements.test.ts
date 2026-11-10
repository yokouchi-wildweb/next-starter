// 機能を要する設定の値の検査(設定 D107・D110)。判定の純関数と、今の木が通ること。
// 実行: FEATURE_GATE_CHECK=all pnpm test src/featureGate/checks/featureRequirements.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";

import { checkFeatureRequirements, requiresFeature, unmetRequirements, valueAt, type RequirementSubject } from "./featureRequirements";

const subject = (composed: Record<string, unknown> | null, requirements: RequirementSubject["requirements"]): RequirementSubject => ({
  district: "features/wallet",
  configPath: "src/features/core/wallet/config.ts",
  overridePath: "src/config/features/wallet.config.ts",
  requirements,
  composed,
});
const known = (name: string) => ["phoneVerification", "demoPages"].includes(name);
const req = { key: "purchaseRestriction", feature: "phoneVerification", off: "none" };

test("valueAt: 点区切りの鍵で読む・無ければ undefined", () => {
  assert.equal(valueAt({ a: { b: { c: 1 } } }, "a.b.c"), 1);
  assert.equal(valueAt({ a: 1 }, "a.b"), undefined);
});

test("requiresFeature: off と違えば要する、element は要素に off 以外があれば要する", () => {
  assert.equal(requiresFeature("phoneVerified", req), true);
  assert.equal(requiresFeature("none", req), false);
  const element = { key: "items", feature: "x", off: "plain", element: true as const };
  assert.equal(requiresFeature(["plain", "plain"], element), false);
  assert.equal(requiresFeature(["plain", "phone"], element), true);
  assert.equal(requiresFeature([], element), false);
});

test("値が off なら機能が閉でも通る / off でなく機能が閉なら失敗し、直し方 2 つを出す / 開なら通る", () => {
  assert.deepEqual(unmetRequirements([subject({ purchaseRestriction: "none" }, [req])], () => false, known), []);
  const [problem, ...rest] = unmetRequirements([subject({ purchaseRestriction: "phoneVerified" }, [req])], () => false, known);
  assert.equal(rest.length, 0);
  assert.match(problem, /features\/wallet の purchaseRestriction = "phoneVerified" は機能 phoneVerification を要する/);
  assert.match(problem, /pnpm ops features set phoneVerification on/);
  assert.match(problem, /src\/config\/features\/wallet\.config\.ts に purchaseRestriction = "none"/);
  assert.deepEqual(unmetRequirements([subject({ purchaseRestriction: "phoneVerified" }, [req])], () => true, known), []);
});

test("宣言の誤り: 知らない機能・合成した設定に無い鍵・読めない設定は失敗", () => {
  assert.match(unmetRequirements([subject({ purchaseRestriction: "x" }, [{ ...req, feature: "nope" }])], () => true, known)[0], /門番の規則に無い/);
  assert.match(unmetRequirements([subject({}, [req])], () => true, known)[0], /合成した設定に鍵が無い/);
  assert.match(unmetRequirements([subject(null, [req])], () => true, known)[0], /合成した設定を読めない/);
});

test("今の木: 上流の宣言(wallet・proxies の demo)は既定の値で守られている", async () => {
  const { problems, checked } = await checkFeatureRequirements(process.cwd());
  assert.deepEqual(problems, []);
  assert.ok(checked >= 2, `宣言は 2 つ以上(${checked})`);
});
