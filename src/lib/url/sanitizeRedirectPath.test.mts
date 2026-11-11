// src/lib/url/sanitizeRedirectPath.test.mts
// オープンリダイレクト対策（sanitizeRedirectPath）の回帰テスト。resolveReturnTo の検査は src/lib/crud/utils/paths.test.mts
// 実行: pnpm test src/lib/url/sanitizeRedirectPath.test.mts

import assert from "node:assert/strict";
import { test } from "node:test";

import { sanitizeRedirectPath } from "./sanitizeRedirectPath.ts";

test("同一オリジンの相対パスはクエリ・ハッシュごと通す", () => {
  assert.equal(sanitizeRedirectPath("/"), "/");
  assert.equal(sanitizeRedirectPath("/mypage?tab=line#top"), "/mypage?tab=line#top");
  assert.equal(sanitizeRedirectPath("/a/b/../c"), "/a/c");
  // エンコード済みの改行はパス文字として扱われ、外部へは出ない
  assert.equal(sanitizeRedirectPath("/x%0d%0aSet-Cookie:a=b"), "/x%0d%0aSet-Cookie:a=b");
});

test("外部へ出る値・不正な値は fallback になる", () => {
  const rejected = [
    "",
    "//evil.example",
    "//evil.example/path",
    "/\\evil.example",
    "/\\/evil.example",
    "https://evil.example",
    "http:/evil.example",
    "javascript:alert(1)",
    "evil.example",
    "mypage",
    "/\tevil",
    "/x\r\nSet-Cookie:a=b",
  ];
  for (const value of rejected) {
    assert.equal(sanitizeRedirectPath(value), "/", JSON.stringify(value));
  }
  assert.equal(sanitizeRedirectPath(undefined), "/");
  assert.equal(sanitizeRedirectPath(null), "/");
  assert.equal(sanitizeRedirectPath(123), "/");
  assert.equal(sanitizeRedirectPath("//evil.example", "/home"), "/home");
  assert.equal(sanitizeRedirectPath("//evil.example", ""), "");
});
