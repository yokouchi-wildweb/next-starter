// src/lib/spamGuard/config.test.ts
// 使い捨てメールの判定の設定の上書きがチェックモードに効くことのテスト。実行: pnpm test src/lib/spamGuard (node:test)
// full は DeBounce API へ出るので試さない(disabled と strict だけで上書きの効き方を見る)
import { test } from "node:test";
import assert from "node:assert/strict";

import { checkDisposableEmail } from "./checker";
import { spamGuardConfig, spamGuardConfigDef } from "./config";

test("上流の空の上書き(@lib-config/spamGuard)では既定の disabled", () => {
  assert.deepEqual(spamGuardConfig, { emailCheckMode: "disabled" });
});

test("disabled はローカルパートの文字チェックだけ(信頼ドメイン以外も通す)", async () => {
  const config = spamGuardConfigDef.compose({});
  assert.equal(await checkDisposableEmail("user@example.com", config), false);
  assert.equal(await checkDisposableEmail("user+tag@example.com", config), true, "+ はモードに関係なく止める");
});

test("上書きの strict は信頼ドメインだけを通す", async () => {
  const config = spamGuardConfigDef.compose({ emailCheckMode: "strict" });
  assert.equal(await checkDisposableEmail("user@example.com", config), true);
  assert.equal(await checkDisposableEmail("user@gmail.com", config), false);
});
