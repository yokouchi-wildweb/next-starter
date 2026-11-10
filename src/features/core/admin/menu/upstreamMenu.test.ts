// src/features/core/admin/menu/upstreamMenu.test.ts
// 上流の管理メニューの中身(categories/・items/ の生成の一覧)を組み立て器に通した形の回帰。
// - 全部開いた admin: カテゴリーの並びと行
// - 門番の規則を全部閉じた admin: 規則の住所の行が消え、行の無いカテゴリーは描かない(規則の pathPatterns をそのまま使う)
// 実行: pnpm test src/features/core/admin

import assert from "node:assert/strict";
import { test } from "node:test";

import { menuCategories } from "@/features/core/admin/extensions/menuCategories";
import { menuItems } from "@/features/core/admin/extensions/menuItems";
import { rules } from "@/featureGate/extensions/rules";
import { matchesPath } from "@/lib/pathPattern/index.mjs";
import { adminDomains } from "@/registry/adminDomains";
import { readForkIdentity } from "@/lib/forkOwnership/forkIds.mjs";

import { buildAdminMenu } from "./buildAdminMenu";
import { adminMenuSources } from "./sources";
import type { BuildAdminMenuInput } from "./types";

const input = (isClosed: (href: string) => boolean): BuildAdminMenuInput => ({
  categories: menuCategories,
  items: menuItems,
  domains: adminDomains,
  sources: adminMenuSources(),
  role: "admin",
  isClosed,
});

// このファイルは上流のメニューの中身そのものの回帰 = Tier1 だけ。fork の生成の一覧には fork のカテゴリー・項目・override が入る
// (組み立ての仕組みは buildAdminMenu.test.ts が作り物でどの段でも確かめる)
const isTier1 = readForkIdentity(process.cwd()).isTier1 === true;
const upstreamTest = (name: string, fn: () => void) =>
  test(name, (t) => {
    if (!isTier1) {
      t.skip("上流の管理メニューの中身の検査（Tier1 だけ。fork の一覧は fork のカテゴリー・項目・override を含む）");
      return;
    }
    fn();
  });

const shape = (menu: ReturnType<typeof buildAdminMenu>) =>
  menu.categories.map((c) => [c.label, c.rows.map((r) => r.label)]);

upstreamTest("全部開いた admin: マーケティング → リクエスト管理 → データ管理 → ユーザー管理 → コミュニティ → システム", () => {
  const menu = buildAdminMenu(input(() => false));
  assert.deepEqual(shape(menu), [
    ["マーケティング", ["お知らせ", "通知テンプレート", "クーポン"]],
    ["リクエスト管理", ["銀行振込レビュー"]],
    ["データ管理", ["サンプル", "サンプルカテゴリ", "サンプルタグ"]],
    ["ユーザー管理", ["登録ユーザー", "システム管理者", "デモユーザー", "ユーザータグ"]],
    ["コミュニティ", ["チャットルーム"]],
    ["システム", ["基本設定", "メンテナンス"]],
  ]);
  assert.deepEqual(menu.duplicates, []);
  assert.deepEqual(menu.hidden, []);
  for (const category of menu.categories) {
    assert.ok(category.icon, `カテゴリー ${category.key} にアイコンが無い`);
    for (const row of category.rows) assert.ok(row.icon, `行 ${row.key} にアイコンが無い`);
  }
  assert.deepEqual(
    Object.values(menuCategories)
      .map((c) => [c.key, c.order])
      .sort((a, b) => Number(a[1]) - Number(b[1])),
    [
      ["marketing", 100],
      ["requests", 200],
      ["data", 300],
      ["users", 400],
      ["community", 500],
      ["system", 900],
    ],
  );
  for (const category of Object.values(menuCategories))
    assert.equal(category.allowRoles, undefined, `上流のカテゴリー ${category.key} に allowRoles`);
});

upstreamTest("門番の規則を全部閉じた admin: 規則の無い住所の行だけが残る", () => {
  const closedPatterns = rules.flatMap((rule) => rule.pathPatterns);
  const menu = buildAdminMenu(input((href) => closedPatterns.some((pattern) => matchesPath(href, pattern))));
  assert.deepEqual(shape(menu), [
    ["ユーザー管理", ["登録ユーザー", "システム管理者", "ユーザータグ"]],
    ["システム", ["基本設定", "メンテナンス"]],
  ]);
});

upstreamTest("管理者でない(ロール user): ロールの絞りの無い行だけ", () => {
  const menu = buildAdminMenu({ ...input(() => false), role: "user" });
  assert.deepEqual(shape(menu), [
    ["マーケティング", ["お知らせ", "通知テンプレート", "クーポン"]],
    ["データ管理", ["サンプル", "サンプルカテゴリ", "サンプルタグ"]],
    ["コミュニティ", ["チャットルーム"]],
    ["システム", ["基本設定", "メンテナンス"]],
  ]);
});
