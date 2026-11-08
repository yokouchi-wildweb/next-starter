// src/features/core/admin/menu/buildAdminMenu.test.ts
// 組み立て器の手順ごとの回帰: ロール(AND)・閉じた住所(厳密)・展開・空カテゴリーの除去・並び・重複・未知のドメイン/カテゴリー
// 実行: pnpm test src/features/core/admin

import assert from "node:assert/strict";
import { test } from "node:test";

import { buildAdminMenu, dataMenuRows } from "./buildAdminMenu";
import type { AdminMenuCategoryDefinition, AdminMenuItemDefinition, BuildAdminMenuInput } from "./types";

const keyed = <T extends { key: string }>(list: T[]): Record<string, T> => Object.fromEntries(list.map((x) => [x.key, x]));

const domains = {
  sample: { label: "サンプル", href: "/admin/samples", addToAdminDataMenu: true },
  chatRoom: { label: "チャットルーム", href: "/admin/chat-rooms", addToAdminDataMenu: false },
};

function input(over: Partial<BuildAdminMenuInput> & { categoryList?: AdminMenuCategoryDefinition[]; itemList?: AdminMenuItemDefinition[] }): BuildAdminMenuInput {
  const { categoryList = [], itemList = [], ...rest } = over;
  return {
    categories: keyed(categoryList),
    items: keyed(itemList),
    domains,
    sources: { dataMenu: dataMenuRows(domains), settingSections: [] },
    role: "admin",
    isClosed: () => false,
    ...rest,
  };
}

const shape = (menu: ReturnType<typeof buildAdminMenu>) => menu.categories.map((c) => [c.key, c.rows.map((r) => r.label)]);

test("並び: カテゴリーも項目も order 昇順、同じ値は key 順", () => {
  const menu = buildAdminMenu(input({
    categoryList: [
      { key: "b", label: "B", order: 100 },
      { key: "a", label: "A", order: 100 },
      { key: "z", label: "Z", order: 50 },
    ],
    itemList: [
      { key: "y", category: "a", order: 20, label: "Y", href: "/admin/y" },
      { key: "x", category: "a", order: 20, label: "X", href: "/admin/x" },
      { key: "w", category: "a", order: 10, label: "W", href: "/admin/w" },
      { key: "v", category: "b", order: 10, label: "V", href: "/admin/v" },
      { key: "u", category: "z", order: 10, label: "U", href: "/admin/u" },
    ],
  }));
  assert.deepEqual(shape(menu), [["z", ["U"]], ["a", ["W", "X", "Y"]], ["b", ["V"]]]);
});

test("展開: 出どころの行を項目の位置に並べ、行のアイコンが無ければ項目のアイコン。domain は一覧の題名と住所(label で題名だけ差し替え)", () => {
  const Icon = (() => null) as never;
  const menu = buildAdminMenu(input({
    categoryList: [{ key: "data", label: "データ", order: 100 }],
    itemList: [
      { key: "first", category: "data", order: 10, label: "先頭", href: "/admin/first" },
      { key: "data-menu", category: "data", order: 20, source: "dataMenu", icon: Icon },
      { key: "chat", category: "data", order: 30, domain: "chatRoom" },
      { key: "chat2", category: "data", order: 40, domain: "chatRoom", label: "部屋" },
    ],
  }));
  const rows = menu.categories[0].rows;
  assert.deepEqual(rows.map((r) => [r.key, r.label, r.href]), [
    ["first", "先頭", "/admin/first"],
    ["data-menu#0", "サンプル", "/admin/samples"],
    ["chat", "チャットルーム", "/admin/chat-rooms"],
    ["chat2", "部屋", "/admin/chat-rooms"],
  ]);
  assert.equal(rows[1].icon, Icon);
  assert.deepEqual(menu.duplicates, [{ kind: "href", href: "/admin/chat-rooms", rowKeys: ["chat", "chat2"] }]);
});

test("ロール: カテゴリー AND 項目 AND 展開した行。ロールの無い人には指定のある物は見えない", () => {
  const base = {
    categoryList: [
      { key: "open", label: "全員", order: 100 },
      { key: "admins", label: "管理者だけ", order: 200, allowRoles: ["admin" as const] },
    ],
    itemList: [
      { key: "a", category: "open", order: 10, label: "A", href: "/admin/a" },
      { key: "b", category: "open", order: 20, label: "B", href: "/admin/b", allowRoles: ["admin" as const] },
      { key: "s", category: "open", order: 30, source: "settingSections" as const },
      { key: "c", category: "admins", order: 10, label: "C", href: "/admin/c" },
    ],
    sources: { dataMenu: [], settingSections: [{ label: "基本", href: "/admin/settings/general" }, { label: "保守", href: "/admin/settings/maintenance", allowRoles: ["admin"] }] },
  };
  assert.deepEqual(shape(buildAdminMenu(input({ ...base, role: "admin" }))), [["open", ["A", "B", "基本", "保守"]], ["admins", ["C"]]]);
  const editor = buildAdminMenu(input({ ...base, role: "editor" }));
  assert.deepEqual(shape(editor), [["open", ["A", "基本"]]]);
  assert.deepEqual(editor.hidden.map((h) => [h.kind, h.key, h.reason]), [
    ["item", "b", "role"],
    ["row", "s#1", "role"],
    ["category", "admins", "category-role"],
  ]);
  assert.deepEqual(shape(buildAdminMenu(input({ ...base, role: undefined }))), [["open", ["A", "基本"]]]);
});

test("門番: 閉じた住所の行を隠す(展開した行も)。行が 0 のカテゴリーは描かない", () => {
  const menu = buildAdminMenu(input({
    categoryList: [
      { key: "data", label: "データ", order: 100 },
      { key: "marketing", label: "マーケ", order: 200 },
    ],
    itemList: [
      { key: "data-menu", category: "data", order: 10, source: "dataMenu" },
      { key: "news", category: "marketing", order: 10, label: "お知らせ", href: "/admin/notifications" },
    ],
    isClosed: (href) => href === "/admin/samples" || href === "/admin/notifications",
  }));
  assert.deepEqual(shape(menu), []);
  assert.deepEqual(menu.hidden.map((h) => [h.kind, h.key, h.reason]), [
    ["row", "data-menu#0", "closed"],
    ["category", "data", "empty-category"],
    ["row", "news", "closed"],
    ["category", "marketing", "empty-category"],
  ]);
});

test("hidden(override): カテゴリーごと・項目ごとに描かない。未知のドメイン・カテゴリーは描かず理由を残す", () => {
  const menu = buildAdminMenu(input({
    categoryList: [
      { key: "gone", label: "消す", order: 100, hidden: true },
      { key: "keep", label: "残す", order: 200 },
    ],
    itemList: [
      { key: "g", category: "gone", order: 10, label: "G", href: "/admin/g" },
      { key: "k", category: "keep", order: 10, label: "K", href: "/admin/k" },
      { key: "h", category: "keep", order: 20, label: "H", href: "/admin/h", hidden: true },
      { key: "ghost", category: "keep", order: 30, domain: "nope" },
      { key: "lost", category: "nowhere", order: 10, label: "L", href: "/admin/l" },
    ],
  }));
  assert.deepEqual(shape(menu), [["keep", ["K"]]]);
  assert.deepEqual(menu.hidden.map((h) => [h.kind, h.key, h.reason]), [
    ["item", "ghost", "unknown-domain"],
    ["item", "lost", "unknown-category"],
    ["category", "gone", "category-hidden"],
    ["item", "h", "item-hidden"],
  ]);
});

test("重複: 同じ出どころを 2 項目が展開しても止めずに報告する", () => {
  const menu = buildAdminMenu(input({
    categoryList: [{ key: "a", label: "A", order: 100 }, { key: "b", label: "B", order: 200 }],
    itemList: [
      { key: "d1", category: "a", order: 10, source: "dataMenu" },
      { key: "d2", category: "b", order: 10, source: "dataMenu" },
    ],
  }));
  assert.deepEqual(shape(menu), [["a", ["サンプル"]], ["b", ["サンプル"]]]);
  assert.deepEqual(menu.duplicates, [
    { kind: "source", source: "dataMenu", itemKeys: ["d1", "d2"] },
    { kind: "href", href: "/admin/samples", rowKeys: ["d1#0", "d2#0"] },
  ]);
});

test("dataMenuRows: addToAdminDataMenu が true のドメインだけ、一覧の順", () => {
  assert.deepEqual(dataMenuRows(domains), [{ label: "サンプル", href: "/admin/samples" }]);
});
