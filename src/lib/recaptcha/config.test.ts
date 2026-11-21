// src/lib/recaptcha/config.test.ts
// reCAPTCHA の設定の上書きがキーと有効の判定に効くことのテスト。実行: pnpm test src/lib/recaptcha (node:test)
import { test } from "node:test";
import assert from "node:assert/strict";

import { recaptchaConfig, recaptchaConfigDef } from "./config";
import { createRecaptchaInternals } from "./server/settings";

const KEY = "k".repeat(40);

// 上流の既定は compose({}) で見る(読み込んだ recaptchaConfig は src/config/lib/recaptcha.config.ts の env の値で変わる)
test("上流の空の上書きでは両方の版が未設定(無効)、読み込んだ設定も同じキー", () => {
  assert.deepEqual(Object.keys(recaptchaConfig).sort(), ["v2", "v3"]);
  const config = recaptchaConfigDef.compose({});
  const v3 = createRecaptchaInternals(() => config.v3);
  assert.equal(v3.siteKey, "");
  assert.equal(v3.secretKey, "");
  assert.equal(v3.enabled, false);
});

test("上書きのサイトキーとシークレットの関数が有効の判定に効く(短いキーは無効)", () => {
  const config = recaptchaConfigDef.compose({ v3: { siteKey: KEY, secretKey: () => KEY }, v2: { siteKey: "short", secretKey: () => KEY } });
  const v3 = createRecaptchaInternals(() => config.v3);
  const v2 = createRecaptchaInternals(() => config.v2);
  assert.equal(v3.enabled, true);
  assert.equal(v2.hasSiteKey, false);
  assert.equal(v2.enabled, false);
});

test("シークレットの関数は作る時には呼ばず、読むたびに呼ぶ(env を後から変えても次の読みで効く)", () => {
  let calls = 0;
  let secret: string | undefined = undefined;
  const config = recaptchaConfigDef.compose({ v2: { siteKey: KEY, secretKey: () => (calls++, secret) } });
  const v2 = createRecaptchaInternals(() => config.v2);
  assert.equal(calls, 0);
  assert.equal(v2.enabled, false);
  secret = KEY;
  assert.equal(v2.enabled, true);
  assert.ok(calls >= 2);
});
