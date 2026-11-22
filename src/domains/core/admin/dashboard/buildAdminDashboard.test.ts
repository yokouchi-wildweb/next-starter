// src/domains/core/admin/dashboard/buildAdminDashboard.test.ts
// 組み立て器の手順ごとの回帰: 並び(order・key)・hidden・ロール・門番の規則(feature)、上流の受け口の中身(Tier1 だけ)
// 実行: pnpm test src/domains/core/admin

import assert from "node:assert/strict";
import { test } from "node:test";

import type { FeatureName } from "@/featureGate";
import { adminDashboardSections } from "@/domains/core/admin/extensions/adminDashboardSections";
import { byKey } from "@/domains/core/admin/menu/byKey";

const dashboardSections = byKey(adminDashboardSections);
import { readForkIdentity } from "@/lib/forkOwnership/node.mjs";

import { buildAdminDashboard, defineDashboardSection } from "./buildAdminDashboard";
import type { AdminDashboardSectionDefinition, BuildAdminDashboardInput } from "./types";

const Empty = () => null;
const def = (key: string, order: number, over: Partial<AdminDashboardSectionDefinition> = {}): AdminDashboardSectionDefinition =>
  defineDashboardSection({ key, order, Section: Empty, ...over });

const input = (list: AdminDashboardSectionDefinition[], over: Partial<BuildAdminDashboardInput> = {}): BuildAdminDashboardInput => ({
  sections: Object.fromEntries(list.map((s) => [s.key, s])),
  role: "admin",
  isEnabled: () => true,
  ...over,
});

const keys = (built: ReturnType<typeof buildAdminDashboard>) => built.sections.map((s) => s.key);

test("並び: order 昇順、同じ値は key 順(ファイル名の順ではない)", () => {
  const built = buildAdminDashboard(input([def("b", 200), def("c", 100), def("a", 200)]));
  assert.deepEqual(keys(built), ["c", "a", "b"]);
  assert.deepEqual(built.hidden, []);
});

test("hidden: 描かず、理由 hidden", () => {
  const built = buildAdminDashboard(input([def("a", 100, { hidden: true }), def("b", 200)]));
  assert.deepEqual(keys(built), ["b"]);
  assert.deepEqual(built.hidden, [{ key: "a", reason: "hidden" }]);
});

test("ロール: allowRoles 未指定・空は全員、指定はそのロールだけ、ロール無しは指定のある物を描かない", () => {
  const list = [def("all", 100), def("empty", 200, { allowRoles: [] }), def("adminOnly", 300, { allowRoles: ["admin"] })];
  assert.deepEqual(keys(buildAdminDashboard(input(list))), ["all", "empty", "adminOnly"]);
  const asUser = buildAdminDashboard(input(list, { role: "user" }));
  assert.deepEqual(keys(asUser), ["all", "empty"]);
  assert.deepEqual(asUser.hidden, [{ key: "adminOnly", reason: "role" }]);
  assert.deepEqual(keys(buildAdminDashboard(input(list, { role: undefined }))), ["all", "empty"]);
});

test("門番: feature の規則が閉じていれば描かず、理由 closed と規則の名前。feature の無い物は聞かない", () => {
  const feature = "userGroups" as FeatureName;
  const asked: string[] = [];
  const built = buildAdminDashboard(
    input([def("gated", 100, { feature }), def("plain", 200)], {
      isEnabled: (name) => {
        asked.push(name);
        return false;
      },
    }),
  );
  assert.deepEqual(keys(built), ["plain"]);
  assert.deepEqual(built.hidden, [{ key: "gated", reason: "closed", feature }]);
  assert.deepEqual(asked, [feature]);
});

test("順の優先: hidden → ロール → 門番(先に当たった理由だけを記録し、門番には聞かない)", () => {
  const asked: string[] = [];
  const built = buildAdminDashboard(
    input([def("a", 100, { hidden: true, allowRoles: ["admin"], feature: "userGroups" as FeatureName })], {
      role: "user",
      isEnabled: (name) => {
        asked.push(name);
        return true;
      },
    }),
  );
  assert.deepEqual(built.hidden, [{ key: "a", reason: "hidden" }]);
  assert.deepEqual(asked, []);
});

// 上流の受け口の中身そのものの回帰 = Tier1 だけ(fork の一覧には fork のセクション・override が入る)
const isTier1 = readForkIdentity(process.cwd()).isTier1 === true;
test("上流のセクション: mainMetrics → additionalMetrics の順で、どちらもロール・門番の指定なし", (t) => {
  if (!isTier1) {
    t.skip("上流のダッシュボードの中身の検査（Tier1 だけ）");
    return;
  }
  const built = buildAdminDashboard({ sections: dashboardSections, role: "admin", isEnabled: () => false });
  assert.deepEqual(keys(built), ["mainMetrics", "additionalMetrics"]);
  assert.equal(typeof dashboardSections.mainMetrics.load, "function");
  assert.equal(dashboardSections.additionalMetrics.load, undefined);
});
