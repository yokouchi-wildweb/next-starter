// src/domains/core/analytics/services/server/coinIssuance/coinIssuance.test.ts
//
// コイン創出サマリーの登録と数える区分の検査(DB なし)。
// - 登録の key: wallet_bonus_grant がある、その部分集合の referral_reward / coupon_attribution_reward は無い(二重計上しない)
// - 数える区分は analytics の設定 issuanceReasonCategories(持ち主の既定 = bonus だけ。other は数えない)
// - 数える通貨は analytics の設定 coinIssuanceWalletTypes(持ち主の既定 regular_coin)
// - 既定は持ち主の既定値(analyticsConfigDef.defaults)で見る: fork は src/config/domains/analytics.config.ts で値を変えてよいので、
//   上書きを通した analyticsConfig に上流の既定を当てない(引数なしの関数は上書きを通した値をそのまま返すことだけを見る)
// 実行: pnpm test src/domains/core/analytics/services/server/coinIssuance/coinIssuance.test.ts
// (package.json に type: module が無いので tsx は CJS として読む → before() で import)
import { before, test } from "node:test";
import assert from "node:assert/strict";

let sources: import("@/domains/core/analytics/services/server/coinIssuance/types").CoinIssuanceSource[];
let issuanceReasonCategories: typeof import("./issuanceCategories").issuanceReasonCategories;
let config: typeof import("@/domains/analytics/config");
before(async () => {
  sources = (await import("@/domains/core/analytics/extensions/analyticsCoinIssuanceSources")).analyticsCoinIssuanceSources.map((entry) => entry.plug);
  ({ issuanceReasonCategories } = await import("./issuanceCategories"));
  config = await import("@/domains/analytics/config");
});

test("登録: wallet_bonus_grant があり、その部分集合のソースは無い", () => {
  const keys = sources.map((s) => s.key);
  assert.ok(keys.includes("wallet_bonus_grant"));
  assert.ok(keys.includes("purchase_bonus_gap"));
  assert.ok(!keys.includes("referral_reward"), "紹介報酬は wallet の bonus の行で wallet_bonus_grant に入る");
  assert.ok(!keys.includes("coupon_attribution_reward"), "クーポン帰属報酬も同じ");
  assert.equal(sources.find((s) => s.key === "wallet_bonus_grant")?.kind, "issuance");
});

test("数える区分: 持ち主の既定は bonus だけ(other は数えない)。引数なしは設定(fork の上書きを通した値)をそのまま返す", () => {
  assert.deepEqual([...config.analyticsConfigDef.defaults.issuanceReasonCategories], ["bonus"]);
  assert.deepEqual(issuanceReasonCategories(), [...config.analyticsConfig.issuanceReasonCategories]);
});

test("数える区分: 渡した一覧をそのまま返す(fork の区分も上書きの一覧で入る)", () => {
  assert.deepEqual(issuanceReasonCategories(["bonus", "other", "gacha_play"] as never[]), ["bonus", "other", "gacha_play"]);
});

test("数える通貨: 持ち主の既定は regular_coin", () => {
  assert.deepEqual([...config.analyticsConfigDef.defaults.coinIssuanceWalletTypes], ["regular_coin"]);
});
