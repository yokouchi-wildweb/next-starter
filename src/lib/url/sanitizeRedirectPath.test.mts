// src/lib/url/sanitizeRedirectPath.test.mts
// オープンリダイレクト対策（sanitizeRedirectPath / resolveReturnTo）の回帰テスト
// 実行: pnpm test:sanitize-redirect

import assert from "node:assert/strict";
import { test } from "node:test";

import { sanitizeRedirectPath } from "./sanitizeRedirectPath.ts";
import { resolveReturnTo } from "../crud/utils/paths.ts";

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

test("resolveReturnTo も同じ判定を使う（/\\ 始まりを通さない）", () => {
  assert.equal(resolveReturnTo("/admin/users?page=2", "/admin"), "/admin/users?page=2");
  assert.equal(resolveReturnTo("/\\evil.example", "/admin"), "/admin");
  assert.equal(resolveReturnTo("//evil.example", "/admin"), "/admin");
  assert.equal(resolveReturnTo(undefined, "/admin"), "/admin");
});
