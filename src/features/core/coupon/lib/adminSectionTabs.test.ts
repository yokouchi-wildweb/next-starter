// src/features/core/coupon/lib/adminSectionTabs.test.ts
//
// クーポン管理画面のセクションタブの組み立ての検査(DB なし)。
// - 上流の一覧は空 = core 3 タブだけ
// - enabled 省略 = 出す、enabled() が false = 外す、返す値に enabled は残らない
// - value の重複は無効の項目も含めて例外
// 実行: pnpm test src/features/core/coupon/lib/adminSectionTabs.test.ts
// (package.json に type: module が無いので tsx は CJS として読む → before() で import)
import { before, test } from "node:test";
import assert from "node:assert/strict";

let mod: typeof import("./adminSectionTabs");
before(async () => {
  mod = await import("./adminSectionTabs");
});

const CORE = ["official", "affiliate", "invite"];

test("上流の項目は 0 = core 3 タブだけ", () => {
  assert.deepEqual(
    mod.buildCouponAdminSectionTabs().map((tab) => tab.value),
    CORE,
  );
});

test("enabled 省略 = 末尾に足す、false = 外す、enabled は返す値に残らない", () => {
  const tabs = mod.composeCouponAdminSectionTabs([
    { value: "friend", label: "フレンド", href: "/admin/coupons/friend" },
    { value: "hidden", label: "隠す", href: "/admin/coupons/hidden", enabled: () => false },
    { value: "shown", label: "出す", href: "/admin/coupons/shown", enabled: () => true },
  ]);
  assert.deepEqual(
    tabs.map((tab) => tab.value),
    [...CORE, "friend", "shown"],
  );
  assert.ok(tabs.every((tab) => !("enabled" in tab)));
});

test("value の重複は無効の項目も含めて例外", () => {
  assert.throws(
    () => mod.composeCouponAdminSectionTabs([{ value: "official", label: "x", href: "/x", enabled: () => false }]),
    /official/,
  );
  assert.throws(
    () =>
      mod.composeCouponAdminSectionTabs([
        { value: "a", label: "a", href: "/a", enabled: () => false },
        { value: "a", label: "a", href: "/a" },
      ]),
    /"a"/,
  );
});
