// src/lib/crud/utils/paths.test.mts
// resolveReturnTo のオープンリダイレクト対策の回帰テスト(判定の本体は @/lib/url の sanitizeRedirectPath)
// 実行: pnpm test src/lib/crud/utils/paths.test.mts

import assert from "node:assert/strict";
import { test } from "node:test";

import { resolveReturnTo } from "./paths.ts";

test("resolveReturnTo も同じ判定を使う（/\\ 始まりを通さない）", () => {
  assert.equal(resolveReturnTo("/admin/users?page=2", "/admin"), "/admin/users?page=2");
  assert.equal(resolveReturnTo("/\\evil.example", "/admin"), "/admin");
  assert.equal(resolveReturnTo("//evil.example", "/admin"), "/admin");
  assert.equal(resolveReturnTo(undefined, "/admin"), "/admin");
});
