// src/lib/url/config.test.ts
// アプリのベース URL の設定の上書きが効くことのテスト。実行: pnpm test src/lib/url (node:test)
import { test } from "node:test";
import assert from "node:assert/strict";

import { urlConfigDef } from "./config";

test("上書きが無ければ既定はプレースホルダー", () => {
  assert.deepEqual(urlConfigDef.compose({}), { baseUrl: "https://example.com" });
});

test("上書きの baseUrl が効く", () => {
  assert.equal(urlConfigDef.compose({ baseUrl: "https://app.example.jp" }).baseUrl, "https://app.example.jp");
});
