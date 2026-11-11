// src/lib/analyticsConsent/consent.test.ts
//
// アクセス解析の送信の門の検査（計測サービス不要）。
// 1. 設定と同意の組み合わせ（decideAnalyticsAllowed）と、読み込んだ設定での isAnalyticsAllowed
// 2. 同意の状態の購読
// Firebase Analytics が門に従うことの検査は src/lib/firebase/client/analytics.test.ts
// (package.json に type: module が無いので tsx は CJS として読む → before() で import)
import { before, beforeEach, test } from "node:test";
import assert from "node:assert/strict";

let consent: typeof import("./consent");
let config: typeof import("./config").analyticsConsentConfig;
before(async () => {
  consent = await import("./consent");
  ({ analyticsConsentConfig: config } = await import("./config"));
});

beforeEach(() => {
  consent.setAnalyticsConsent("unknown");
  config.enabled = false;
  config.consent = "required";
});

test("decideAnalyticsAllowed: 無効なら同意があっても送らない、有効なら同意の扱いに従う", () => {
  const { decideAnalyticsAllowed } = consent;
  for (const c of ["granted", "denied", "unknown"] as const) {
    assert.equal(decideAnalyticsAllowed({ enabled: false, consent: "notRequired" }, c), false);
    assert.equal(decideAnalyticsAllowed({ enabled: false, consent: "required" }, c), false);
    assert.equal(decideAnalyticsAllowed({ enabled: true, consent: "notRequired" }, c), true);
  }
  assert.equal(decideAnalyticsAllowed({ enabled: true, consent: "required" }, "granted"), true);
  assert.equal(decideAnalyticsAllowed({ enabled: true, consent: "required" }, "denied"), false);
  assert.equal(decideAnalyticsAllowed({ enabled: true, consent: "required" }, "unknown"), false);
});

// 上流の既定は compose({}) で見る(読み込んだ設定は fork が src/config/lib/analyticsConsent.config.ts に書いた値で変わる)
test("既定の設定は無効・同意が必要、上書きの値が効く", async () => {
  const { analyticsConsentConfigDef } = await import("./config");
  assert.deepEqual(analyticsConsentConfigDef.compose({}), { enabled: false, consent: "required" });
  assert.deepEqual(analyticsConsentConfigDef.compose({ enabled: true }), { enabled: true, consent: "required" });
  assert.equal(analyticsConsentConfigDef.compose({ consent: "notRequired" }).consent, "notRequired");
});

test("setAnalyticsConsent は変わったときだけ購読者に知らせ、解除後は知らせない", () => {
  const seen: string[] = [];
  const off = consent.subscribeAnalyticsConsent((c) => seen.push(c));
  consent.setAnalyticsConsent("granted");
  consent.setAnalyticsConsent("granted");
  consent.setAnalyticsConsent("denied");
  off();
  consent.setAnalyticsConsent("granted");
  assert.deepEqual(seen, ["granted", "denied"]);
  assert.equal(consent.getAnalyticsConsent(), "granted");
});

test("isAnalyticsAllowed は読み込んだ設定と今の同意で答える", () => {
  assert.equal(consent.isAnalyticsAllowed(), false, "無効なら送らない");
  config.enabled = true;
  assert.equal(consent.isAnalyticsAllowed(), false, "同意が必要で未回答なら送らない");
  consent.setAnalyticsConsent("granted");
  assert.equal(consent.isAnalyticsAllowed(), true);
  consent.setAnalyticsConsent("denied");
  assert.equal(consent.isAnalyticsAllowed(), false);
  config.consent = "notRequired";
  assert.equal(consent.isAnalyticsAllowed(), true, "notRequired なら同意を待たない");
});
