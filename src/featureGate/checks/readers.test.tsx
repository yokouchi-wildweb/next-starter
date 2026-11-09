// src/featureGate/checks/readers.test.tsx
// 門番の読み手の回帰テスト: 管理のサイドバー(routed 20261103-140211)と /demo の一覧(routed 20261103-172638)。
// - サイドバー: 管理の枠の値(clientGateState("admin"))の useGate().path で、閉じた規則の住所の行を除き(厳密: redirectTo 付きの閉も)、行が 0 のカテゴリーを描かない(useAdminMenu)
// - /demo: loader と同じ gate.filter(demoPages, demoHref)で閉じた住所のデモを除き、画面の数(一覧の長さ・カテゴリの数)もそこから数える
// 閉じた状態は一覧の規則の enabled を一時的に差し替えて作る(config の値に依らない)。実行: pnpm test src/featureGate/checks/readers.test.tsx

import assert from "node:assert/strict";
import { test } from "node:test";

import { demoHref, groupDemoPagesByCategory } from "@/app/(user)/demo/_data/demoPages";
import { demoPages } from "@/app/(user)/demo/extensions/demoPages";
import { gate, type FeatureName, type GatedFeatureRule, type GeneratedFeatureRule } from "@/featureGate";
import { rules as generatedRules } from "@/featureGate/extensions/rules";
import { derivedPaths, rules } from "@/featureGate/node";
import { coveredPatternsOf } from "@/featureGate/ruleList";
import type { DerivedPath } from "@/featureGate/ruleList";
import { menuItems } from "@/features/core/admin/extensions/menuItems";
import { matchesPath } from "@/lib/pathPattern/index.mjs";

import { adminSidebar, adminSidebarHrefs } from "./adminSidebar";

function withRules<T>(states: Partial<Record<FeatureName, boolean>>, fn: () => T): T {
  // 生成一覧の規則の値(自分の値)を差し替える: 判定は依存先(dependsOn)まで解くので、親を閉じれば子も閉じる
  const saved = new Map<GeneratedFeatureRule, GeneratedFeatureRule["enabled"]>();
  for (const rule of generatedRules) {
    saved.set(rule, rule.enabled);
    const state = states[rule.name];
    rule.enabled = () => state ?? true;
  }
  try {
    return fn();
  } finally {
    for (const [rule, enabled] of saved) rule.enabled = enabled;
  }
}

// 規則を閉じれば閉じる住所 = 自分の住所 + ドメインの導出の住所 + 依存元の住所(coveredPatternsOf)
const closedBy = (rule: GatedFeatureRule, href: string) => coveredPatternsOf(rule).some((p) => matchesPath(href.split(/[?#]/)[0], p));

test("サイドバー: 規則を 1 つずつ閉じ、その住所の行が無く(redirectTo 付きも)、他の行は全部開いたときと同じ。行の無いカテゴリーは描かない", () => {
  const allHrefs = withRules({}, () => adminSidebarHrefs());
  assert.ok(allHrefs.length > 0);
  for (const rule of rules) {
    withRules({ [rule.name]: false }, () => {
      const categories = adminSidebar();
      assert.deepEqual(categories.flatMap((c) => c.rows.map((r) => r.href)), allHrefs.filter((h) => !closedBy(rule, h)), rule.name);
      for (const category of categories) assert.ok(category.rows.length > 0, `${rule.name}: 空のカテゴリー ${category.key}`);
    });
  }
});

test("サイドバー: sampleDomain を閉じると sample の行が無く、行の無くなった「データ管理」も描かない", () => {
  const sample = rules.find((r) => r.name === "sampleDomain");
  assert.ok(sample);
  const isSample = (href: string) => coveredPatternsOf(sample).some((p) => matchesPath(href, p));
  assert.ok(withRules({}, () => adminSidebarHrefs()).some(isSample), "メニューに sample の行がある前提");
  withRules({ sampleDomain: false }, () => {
    assert.equal(adminSidebarHrefs().filter(isSample).length, 0);
    assert.equal(adminSidebar().some((c) => c.key === "data"), false);
  });
});

test("サイドバー: 銀行振込レビューを閉じると「リクエスト管理」のカテゴリーごと描かない", () => {
  assert.ok(Object.values(menuItems).some((item) => item.category === "requests"), "上流の項目に requests がある前提");
  withRules({ bankTransferReview: false }, () => {
    assert.equal(adminSidebar().some((c) => c.key === "requests"), false);
  });
});

test("/demo: sampleDomain を閉じると sample のデモが一覧と数から消える。どの規則を閉じても一覧に閉じた住所が無く、数は一覧と同じ", () => {
  const sample = rules.find((r) => r.name === "sampleDomain");
  assert.ok(sample);
  // サンプルを読むデモ画面は小さな機能 demoSampleDomain(sampleDomain に dependsOn)の住所 = sampleDomain を閉じれば閉じる住所
  const sampleDemos = demoPages.filter((page) => coveredPatternsOf(sample).some((p) => matchesPath(demoHref(page), p)));
  assert.ok(sampleDemos.length > 0, "sample のデモがある前提");
  withRules({ sampleDomain: false }, () => {
    const pages = gate.filter(demoPages, demoHref);
    assert.equal(pages.length, demoPages.length - sampleDemos.length);
    const counted = groupDemoPagesByCategory(pages).reduce((n, g) => n + g.pages.length, 0);
    assert.equal(counted, pages.length);
  });
  for (const rule of rules) {
    withRules({ [rule.name]: false }, () => {
      const pages = gate.filter(demoPages, demoHref);
      for (const page of pages) assert.ok(gate.path(demoHref(page)).open, `${rule.name}: ${demoHref(page)}`);
      assert.equal(groupDemoPagesByCategory(pages).reduce((n, g) => n + g.pages.length, 0), pages.length);
    });
  }
});

test("設定の節(L1.17・D34 K4): 節の feature が名指す機能が閉じると節の住所(/admin/settings/<key>)が閉じ、サイドバーの行が消え、既定の節は次の開いた節", async () => {
  const { sections } = await import("@/features/core/setting/extensions/sections");
  const { firstOpenSection, settingSectionHref } = await import("@/features/core/setting/utils/sectionForm");
  const sample = rules.find((r) => r.name === "sampleDomain");
  assert.ok(sample);
  // fixture: general 節が feature: "sampleDomain" を持つときの導出の住所(生成一覧の settingSections から ruleList が作る項目)を一時的に足す
  const href = settingSectionHref("general");
  const paths = derivedPaths as DerivedPath[];
  const added: DerivedPath = { pattern: href, kind: "setting", folders: [], features: ["sampleDomain"] };
  paths.push(added);
  try {
    assert.ok(!sample.pathPatterns.includes(href), "節の住所は機能の pathPatterns に入れない");
    withRules({ sampleDomain: false }, () => {
      const hrefs = adminSidebarHrefs();
      assert.ok(!hrefs.includes(href));
      assert.ok(hrefs.includes(settingSectionHref("maintenance")));
      assert.equal(gate.path(href).open, false);
      assert.notEqual(firstOpenSection(sections, (h) => gate.path(h).open)?.key, "general");
    });
    withRules({}, () => {
      assert.ok(adminSidebarHrefs().includes(href));
    });
  } finally {
    paths.splice(paths.indexOf(added), 1);
  }
});
