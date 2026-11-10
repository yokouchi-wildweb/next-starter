// マイページのアカウントの項目の判定(userConfig.account.editableItems)の検査
// 実行: pnpm test src/features/core/user/utils/accountItems.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";

import { userConfig, userConfigDef } from "@/features/user/config";
import { isAccountItemEditable, isPhoneNumberInputOpen } from "./accountItems";

// 上流の既定は compose({}) で見る(読み込んだ userConfig は fork が src/config/features/user.config.ts に書いた値で変わる)
test("上流の既定は email・password・profile(phone は入れない)", () => {
  assert.deepEqual([...userConfigDef.compose({}).account.editableItems], ["email", "password", "profile"]);
});

test("一覧を渡さなければ読み込んだ設定(上流 + 上書き)の一覧で判定する", () => {
  const items = userConfig.account.editableItems;
  for (const item of ["email", "password", "profile", "phone"] as const) {
    assert.equal(isAccountItemEditable(item), items.includes(item), item);
  }
});

test("渡した一覧で判定する(一覧に無い項目は false)", () => {
  assert.equal(isAccountItemEditable("profile", ["email", "phone"]), false);
  assert.equal(isAccountItemEditable("phone", ["email", "phone"]), true);
  assert.equal(isAccountItemEditable("email", []), false);
});

test("SMS なしの電話番号の入力は、一覧に phone があり SMS 認証が閉のときだけ", () => {
  assert.equal(isPhoneNumberInputOpen(false, ["email", "phone"]), true);
  assert.equal(isPhoneNumberInputOpen(true, ["email", "phone"]), false);
  assert.equal(isPhoneNumberInputOpen(false, ["email"]), false);
  assert.equal(isPhoneNumberInputOpen(false), false);
});
