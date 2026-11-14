// src/features/core/userGroup/gate.test.ts
// 門 userGroups(D99): 既定 閉、住所 /admin/user-groups・/api/admin/user-groups、ドメイン core/userGroup ごと閉じる
// (表 5 つ・汎用 API の導出の住所)。生成の一覧(規則・地区の表)の実物を読む。実行: pnpm test src/features/core/userGroup
import { test } from "node:test";
import assert from "node:assert/strict";

import type { GatedFeatureRule } from "@/featureGate";
import { resolvePath } from "@/featureGate/evaluate";
import { closedTables } from "@/featureGate/node";
import { closedDerivedEntries, derivedPaths } from "@/featureGate/ruleList";
import { rule } from "@/featureGate/rules/userGroups";

const TABLES = ["user_groups", "user_group_definitions", "user_group_members", "user_group_versions", "user_group_version_members"];
const gated = (open: boolean): GatedFeatureRule =>
  ({ name: "userGroups", ...rule, dependsOn: [], tables: [], domainApiPaths: [], settingPaths: [], cronPaths: [], enabled: () => open }) as unknown as GatedFeatureRule;

test("規則: 既定は閉、住所は管理画面とその API、ドメインは core/userGroup", () => {
  assert.equal(rule.defaultEnabled, false);
  assert.deepEqual(rule.pathPatterns, ["/admin/user-groups", "/api/admin/user-groups"]);
  assert.deepEqual(rule.domains, ["core/userGroup"]);
});

test("閉ならドメインの表 5 つ・住所が閉じ、開なら閉じない", () => {
  assert.deepEqual([...closedTables([gated(false)])].sort(), [...TABLES].sort());
  assert.deepEqual(closedTables([gated(true)]), []);
  for (const path of ["/admin/user-groups", "/api/admin/user-groups/x"]) {
    assert.equal(resolvePath(path, [gated(false)]).open, false, path);
    assert.equal(resolvePath(path, [gated(true)]).open, true, path);
  }
});

test("閉ならドメインの導出の住所(汎用 API があれば)も閉じる", () => {
  const own = derivedPaths.filter((path) => path.folders.includes("core/userGroup"));
  const closed = closedDerivedEntries([gated(false)], own).map((entry) => entry.pattern);
  assert.deepEqual(closed, own.map((path) => path.pattern));
  assert.deepEqual(closedDerivedEntries([gated(true)], own), []);
});
