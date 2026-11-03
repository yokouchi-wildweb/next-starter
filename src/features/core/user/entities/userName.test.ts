// src/features/core/user/entities/userName.test.ts — pnpm test:user-name
// sanitizeUserName の結果が共有スキーマ (UserNameSchema) を通ること・既存の検証は変わらないことの検査。
import { test } from "node:test";
import assert from "node:assert/strict";

import { USER_NAME_CONFIG } from "@/config/app/user-name.config";
import { sanitizeUserName, UserNameSchema } from "./userName";

test("使用できない文字を取り除き、前後の空白を削る", () => {
  assert.equal(sanitizeUserName("  山田\n太郎​\t "), "山田太郎");
  assert.equal(sanitizeUserName("a b c\u0000d"), "abcd");
  assert.equal(sanitizeUserName("ふつうの名前"), "ふつうの名前");
});

test("上限を超える分は末尾を切り、サロゲートペアを割らない", () => {
  const max = USER_NAME_CONFIG.maxLength;
  assert.equal(sanitizeUserName("あ".repeat(max + 5)), "あ".repeat(max));
  const emoji = "😀".repeat(max); // 1 文字 = UTF-16 で 2
  const out = sanitizeUserName(emoji);
  assert.ok(out.length <= max);
  assert.equal(out, "😀".repeat(Math.floor(max / 2)));
});

test("結果は空でなければ UserNameSchema を通る", () => {
  for (const raw of ["  名前\r\n ", "x".repeat(500), "​名‍前​", "😀".repeat(200)]) {
    const out = sanitizeUserName(raw);
    assert.ok(out.length > 0);
    assert.equal(UserNameSchema.safeParse(out).success, true, raw);
  }
});

test("使用できない文字だけなら空文字", () => {
  assert.equal(sanitizeUserName("\n\t​ "), "");
});

test("既存のスキーマは使用できない文字を拒否したまま", () => {
  assert.equal(UserNameSchema.safeParse("山田\n太郎").success, false);
});
