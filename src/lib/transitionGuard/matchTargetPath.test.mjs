// 遷移トークンのパス照合のテスト。
// 実行: pnpm test:transition-guard (node:test + tsx)
import { test } from "node:test";
import assert from "node:assert/strict";

import { matchesTargetPath, toGuardPath } from "./matchTargetPath.ts";

test("toGuardPath はクエリと # 以降を外す", () => {
  assert.equal(toGuardPath("/signup/register"), "/signup/register");
  assert.equal(toGuardPath("/signup/register?method=thirdParty"), "/signup/register");
  assert.equal(toGuardPath("/signup/register#top"), "/signup/register");
  assert.equal(toGuardPath("/signup/register?a=1#top"), "/signup/register");
});

test("同じパス名なら通す(遷移先のクエリ・# は無視)", () => {
  assert.equal(matchesTargetPath("/signup/register", "/signup/register"), true);
  assert.equal(matchesTargetPath("/signup/register?method=thirdParty", "/signup/register"), true);
  assert.equal(matchesTargetPath("/signup/register#top", "/signup/register"), true);
});

test("別のパスは弾く(前方一致・部分一致でも通さない)", () => {
  assert.equal(matchesTargetPath("/signup/complete", "/signup/register"), false);
  assert.equal(matchesTargetPath("/signup/register-x", "/signup/register"), false);
  assert.equal(matchesTargetPath("/signup/register", "/signup/register/extra"), false);
  assert.equal(matchesTargetPath("/signup", "/signup/register"), false);
});
