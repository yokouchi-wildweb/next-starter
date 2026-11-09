// src/features/core/analytics/services/server/coinIssuance/coinIssuance.test.ts
//
// コイン創出サマリーの登録と数える区分の検査(DB なし)。
// - 登録の key: wallet_bonus_grant がある、その部分集合の referral_reward / coupon_attribution_reward は無い(二重計上しない)
// - 数える区分は analytics の設定 issuanceReasonCategories(上流の既定 = bonus だけ。other は数えない)
// - 数える通貨は analytics の設定 coinIssuanceWalletTypes(既定 regular_coin)
// 実行: pnpm test src/features/core/analytics/services/server/coinIssuance/coinIssuance.test.ts
// (package.json に type: module が無いので tsx は CJS として読む → before() で import)
import { before, test } from "node:test";
import assert from "node:assert/strict";

let sources: typeof import("@/features/core/analytics/extensions/coinIssuanceSources").coinIssuanceSources;
let issuanceReasonCategories: typeof import("./issuanceCategories").issuanceReasonCategories;
let coinIssuanceWalletTypes: readonly string[];
before(async () => {
  ({ coinIssuanceSources: sources } = await import("@/features/core/analytics/extensions/coinIssuanceSources"));
  ({ issuanceReasonCategories } = await import("./issuanceCategories"));
  ({ coinIssuanceWalletTypes } = (await import("@/features/analytics/config")).analyticsConfig);
});

test("登録: wallet_bonus_grant があり、その部分集合のソースは無い", () => {
  const keys = sources.map((s) => s.key);
  assert.ok(keys.includes("wallet_bonus_grant"));
  assert.ok(keys.includes("purchase_bonus_gap"));
  assert.ok(!keys.includes("referral_reward"), "紹介報酬は wallet の bonus の行で wallet_bonus_grant に入る");
  assert.ok(!keys.includes("coupon_attribution_reward"), "クーポン帰属報酬も同じ");
  assert.equal(sources.find((s) => s.key === "wallet_bonus_grant")?.kind, "issuance");
});

test("数える区分: 上流の既定は bonus だけ(other は数えない)", () => {
  assert.deepEqual(issuanceReasonCategories(), ["bonus"]);
});

test("数える区分: 渡した一覧をそのまま返す(fork の区分も上書きの一覧で入る)", () => {
  assert.deepEqual(issuanceReasonCategories(["bonus", "other", "gacha_play"] as never[]), ["bonus", "other", "gacha_play"]);
});

test("数える通貨: 既定は regular_coin", () => {
  assert.deepEqual([...coinIssuanceWalletTypes], ["regular_coin"]);
});
