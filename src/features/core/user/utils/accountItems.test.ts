// マイページのアカウントの項目の判定(userConfig.account.editableItems)の検査
// 実行: pnpm test src/features/core/user/utils/accountItems.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";

import { userConfig } from "@/features/user/config";
import { isAccountItemEditable } from "./accountItems";

test("上流の既定は email・password・profile(phone は入れない)", () => {
  assert.deepEqual([...userConfig.account.editableItems], ["email", "password", "profile"]);
  assert.equal(isAccountItemEditable("email"), true);
  assert.equal(isAccountItemEditable("password"), true);
  assert.equal(isAccountItemEditable("profile"), true);
  assert.equal(isAccountItemEditable("phone"), false);
});

test("渡した一覧で判定する(一覧に無い項目は false)", () => {
  assert.equal(isAccountItemEditable("profile", ["email", "phone"]), false);
  assert.equal(isAccountItemEditable("phone", ["email", "phone"]), true);
  assert.equal(isAccountItemEditable("email", []), false);
});
