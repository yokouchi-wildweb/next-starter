// domain.json の closable(閉じられる形の印)は受けない(D26): 書けば true でも false でも生成の前に止め、規則の書き方を案内する。
// 生成カテゴリに featureGate は無い(1 対 1 のひな形の規則・入切の値を書かない)。実行: pnpm test scripts/structure/domain/tests/closableRetired.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";

import { closableIssues } from "../checks/closable.mjs";
import { configIssues } from "../checks/index.mjs";
import { GENERATE_CATEGORIES } from "../spec/categories.mjs";
import { TOP_LEVEL_KEYS } from "../spec/domainJson.mjs";

const base = { domainConfigVersion: "1.3", singular: "shop_item", plural: "shop_items", label: "商品", dbEngine: "Neon", idType: "uuid", fields: [] };

test("closable を書いた domain.json は true でも false でも止まり、規則の書き方を案内する。書かなければ止まらない", () => {
  for (const closable of [true, false, "yes"]) {
    const issues = closableIssues({ ...base, closable });
    assert.equal(issues.length, 1);
    assert.match(issues[0], /closable\(閉じられる形の印\)はなくなった\(D26\)。domain\.json から消す。.*src\/featureGate\/rules\/<機能の名前>\.ts に規則を書き、features にこのドメインのフォルダを入れる/);
  }
  assert.deepEqual(closableIssues(base), []);
  assert.ok(configIssues("shopItem", { ...base, closable: true }).some((issue) => issue.startsWith("[shopItem] closable")));
});

test("語彙とカテゴリに closable・featureGate は無い", () => {
  assert.equal(TOP_LEVEL_KEYS.has("closable"), false);
  assert.equal(GENERATE_CATEGORIES.includes("featureGate"), false);
});
