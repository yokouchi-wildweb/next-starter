// src/lib/mail/config.test.ts
// メール送信の設定の上書きが効くことのテスト。実行: pnpm test src/lib/mail (node:test)
import { test } from "node:test";
import assert from "node:assert/strict";

import { mailConfigDef } from "./config";

test("上書きが無ければ既定(例の差出人)", () => {
  assert.deepEqual(mailConfigDef.compose({}), { defaultFrom: "noreply@example.com", defaultFromName: "next-starter" });
});

test("上書きの値が効き、書かないキーは既定のまま", () => {
  const config = mailConfigDef.compose({ defaultFrom: "info@shop.example.jp" });
  assert.equal(config.defaultFrom, "info@shop.example.jp");
  assert.equal(config.defaultFromName, "next-starter");
});
