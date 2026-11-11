// src/lib/metadata/config.test.ts
// メタデータの設定の上書きが効くことのテスト。実行: pnpm test src/lib/metadata (node:test)
import { test } from "node:test";
import assert from "node:assert/strict";

import { metadataConfigDef } from "./config";

test("上書きの値が効き、書かないキーは既定のまま", () => {
  const config = metadataConfigDef.compose({ siteName: "My Shop", ogImageSize: { width: 800, height: 400 } });
  assert.equal(config.siteName, "My Shop");
  assert.deepEqual(config.ogImageSize, { width: 800, height: 400 });
  assert.equal(config.locale, "ja_JP");
  assert.equal(config.siteUrl, "https://example.com");
});
