// src/lib/business/business.test.ts — 受付係の判定と本番の検査(設定の議会 D88)。実行: pnpm test src/lib/business
import { test } from "node:test";
import assert from "node:assert/strict";

import { EXAMPLE_BUSINESS, checkBusinessRelease, resolveBusiness, sampleReleaseLevel, type BusinessValues } from "./index";

const own: BusinessValues = { ...EXAMPLE_BUSINESS, serviceName: "My Service" };

test("sample は例の値、own は自分の値を返す", () => {
  assert.equal(resolveBusiness({ source: "sample" }), EXAMPLE_BUSINESS);
  assert.equal(resolveBusiness({ source: "own", values: own }).serviceName, "My Service");
});

test("例の値は引数で差し替えられる(他のプロジェクトに組み込むとき)", () => {
  const myExample: BusinessValues = { ...EXAMPLE_BUSINESS, serviceName: "Example Shop" };
  assert.equal(resolveBusiness({ source: "sample" }, myExample), myExample);
  assert.equal(resolveBusiness({ source: "own", values: own }, myExample).serviceName, "My Service");
});

test("本番の検査: sample のまま本番は失敗、Tier1 は警告、own と本番でない段階は通す", () => {
  assert.equal(checkBusinessRelease({ source: "sample", production: true, tier1: false }).level, "error");
  assert.equal(checkBusinessRelease({ source: "sample", production: true, tier1: true }).level, "warn");
  assert.deepEqual(checkBusinessRelease({ source: "sample", production: false, tier1: false }), { level: "ok", message: null });
  assert.deepEqual(checkBusinessRelease({ source: "own", production: true, tier1: false }), { level: "ok", message: null });
  assert.match(checkBusinessRelease({ source: "sample", production: true, tier1: false }).message ?? "", /pnpm ops business from-example/);
});

test("判定の部品 sampleReleaseLevel: sample が無いか本番でなければ ok、あれば error、Tier1 は warn(法務の文書の検査も使う)", () => {
  assert.equal(sampleReleaseLevel({ hasSample: false, production: true, tier1: false }), "ok");
  assert.equal(sampleReleaseLevel({ hasSample: true, production: false, tier1: false }), "ok");
  assert.equal(sampleReleaseLevel({ hasSample: true, production: true, tier1: false }), "error");
  assert.equal(sampleReleaseLevel({ hasSample: true, production: true, tier1: true }), "warn");
});
