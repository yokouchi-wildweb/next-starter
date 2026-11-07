// scripts/admin-menu/inspect.test.ts
// 点検(checkAdminMenu)の失敗の種類ごと・ルート地図の照合・覆う規則・受け口の読み取り(相手の無い上書き)・実リポが通ること
// 実行: pnpm test:admin-menu

import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { test } from "node:test";

import { adminDomains } from "@/registry/adminDomains";

import { readMenuSnapshot, readRoutePaths } from "./collect";
import { checkAdminMenu, coveringRule, routeExists, type MenuSnapshot } from "./inspect";

const routes = [
  "/admin",
  "/admin/users/general",
  "/admin/bank-transfer-reviews/[status]",
  "/admin/docs/[...slug]",
  "/admin/opt/[[...rest]]",
  "/admin/samples",
];
const domains = { sample: { label: "サンプル", href: "/admin/samples", addToAdminDataMenu: true } };

const snapshot = (over: Partial<MenuSnapshot> = {}): MenuSnapshot => ({
  categories: [{ name: "users", file: "c/users.ts", definition: { key: "users", label: "U", order: 100 } }],
  items: [
    {
      name: "general",
      file: "i/general.ts",
      definition: {
        key: "general",
        category: "users",
        order: 10,
        label: "G",
        href: "/admin/users/general",
        allowRoles: ["admin"],
      },
    },
  ],
  orphans: [],
  ...over,
});

test("ルート地図: 動的セグメント [x]・[...x]・[[...x]]、? と # は外して照らす", () => {
  assert.ok(routeExists("/admin/bank-transfer-reviews/pending-review", routes));
  assert.ok(!routeExists("/admin/bank-transfer-reviews", routes));
  assert.ok(routeExists("/admin/docs/a/b", routes));
  assert.ok(!routeExists("/admin/docs", routes));
  assert.ok(routeExists("/admin/opt", routes));
  assert.ok(routeExists("/admin/opt/x/y", routes));
  assert.ok(routeExists("/admin/users/general?tab=1#top", routes));
  assert.ok(!routeExists("/admin/users/generals", routes));
});

test("覆う規則: 閉じた規則が当たればそれ、無ければ当たる最初、当たらなければ null。外部 URL は null", () => {
  const rules = [
    { name: "open", pathPatterns: ["/admin/notifications"], enabled: true },
    { name: "closed", pathPatterns: ["/admin/notifications"], enabled: false },
  ];
  assert.equal(coveringRule("/admin/notifications/send", rules)?.name, "closed");
  assert.equal(coveringRule("/admin/notifications", rules.slice(0, 1))?.name, "open");
  assert.equal(coveringRule("/admin/users", rules), null);
  assert.equal(coveringRule("https://example.com/admin/notifications", rules), null);
});

test("点検: 今の形は通る", () => {
  assert.deepEqual(checkAdminMenu(snapshot(), domains, routes), []);
});

test("点検: 知らないカテゴリー(上書きで移した先も)・知らないドメイン・ページの無い住所・key とファイル名の食い違い・読めない定義", () => {
  const problems = checkAdminMenu(
    snapshot({
      items: [
        {
          name: "a",
          file: "i/a.ts",
          definition: { key: "a", category: "nowhere", order: 10, label: "A", href: "/admin/users/general" },
        },
        {
          name: "b",
          file: "i/b.ts",
          definition: { key: "b", category: "users", order: 10, label: "B", href: "/admin/users/general" },
          override: { file: "i/b.override.ts", value: { category: "gone" } },
        },
        { name: "c", file: "i/c.ts", definition: { key: "c", category: "users", order: 10, domain: "nope" } },
        {
          name: "d",
          file: "i/d.ts",
          definition: { key: "d", category: "users", order: 10, label: "D", href: "/admin/missing" },
        },
        {
          name: "e",
          file: "i/e.ts",
          definition: { key: "other", category: "users", order: 10, label: "E", href: "https://example.com" },
        },
        { name: "f", file: "i/f.ts", definition: null },
        { name: "g", file: "i/g.ts", definition: { key: "g", category: "users", order: 10, domain: "sample" } },
      ],
    }),
    domains,
    routes,
  );
  assert.deepEqual(problems, [
    'i/e.ts: key "other" がファイル名 e と違う(key = ファイル名 = 上書きの相手の名前)',
    "i/f.ts: 定義(export const category / item)を読めない",
    'i/a.ts: カテゴリー "nowhere" が無い',
    'i/b.override.ts: カテゴリー "gone" が無い',
    'i/c.ts: ドメイン "nope" が管理一覧(@/registry/adminDomains)に無い(管理一覧の画面が無いなら link で書く)',
    "i/d.ts: 住所 /admin/missing のページが src/app/route-map.jsonl に無い",
  ]);
});

test("点検: allowRoles は絞るだけ(上流の外のロール・空・絞りの無い上流への追加の区別)", () => {
  const item = (override: Record<string, unknown>, allowRoles?: string[]) =>
    snapshot({
      items: [
        {
          name: "x",
          file: "i/x.ts",
          definition: {
            key: "x",
            category: "users",
            order: 10,
            label: "X",
            href: "/admin/users/general",
            ...(allowRoles ? { allowRoles: allowRoles as never } : {}),
          },
          override: { file: "i/x.override.ts", value: override },
        },
      ],
    });
  assert.deepEqual(checkAdminMenu(item({ allowRoles: ["admin", "editor"] }, ["admin"]), domains, routes), [
    "i/x.override.ts: allowRoles を広げている(上流 [admin] の中だけに絞る)",
  ]);
  assert.deepEqual(checkAdminMenu(item({ allowRoles: [] }, ["admin"]), domains, routes), [
    "i/x.override.ts: allowRoles を広げている(上流 [admin] の中だけに絞る)",
  ]);
  assert.deepEqual(checkAdminMenu(item({ allowRoles: ["admin"] }, ["admin", "editor"]), domains, routes), []);
  assert.deepEqual(checkAdminMenu(item({ allowRoles: ["editor"] }), domains, routes), []);
  const category = snapshot({
    categories: [
      {
        name: "users",
        file: "c/users.ts",
        definition: { key: "users", label: "U", order: 100, allowRoles: ["admin"] },
        override: { file: "c/users.override.ts", value: { allowRoles: ["user"] } },
      },
    ],
  });
  assert.deepEqual(checkAdminMenu(category, domains, routes), [
    "c/users.override.ts: allowRoles を広げている(上流 [admin] の中だけに絞る)",
  ]);
});

test("受け口の読み取り: 上書きを相手に結び、相手の無い上書きを拾う(フォルダ形も項目)", async () => {
  const root = mkdtempSync(join(tmpdir(), "admin-menu-"));
  const put = (path: string, text: string) => {
    mkdirSync(dirname(join(root, path)), { recursive: true });
    writeFileSync(join(root, path), text);
  };
  const base = "src/features/core/admin/menu";
  put(`${base}/categories/users.ts`, 'export const category = { key: "users", label: "U", order: 100 };\n');
  put(`${base}/categories/users.override.ts`, 'export const override = { label: "利用者" };\n');
  put(
    `${base}/items/general.ts`,
    'export const item = { key: "general", category: "users", order: 10, label: "G", href: "/admin/users/general" };\n',
  );
  put(
    `${base}/items/folder/index.ts`,
    'export const item = { key: "folder", category: "users", order: 20, label: "F", href: "/admin/users/general" };\n',
  );
  put(`${base}/items/ghost.override.ts`, "export const override = { hidden: true };\n");
  const snap = await readMenuSnapshot(root);
  assert.deepEqual(
    snap.categories.map((c) => [c.name, c.override?.value]),
    [["users", { label: "利用者" }]],
  );
  assert.deepEqual(
    snap.items.map((i) => i.name),
    ["folder", "general"],
  );
  assert.deepEqual(snap.orphans, [{ file: `${base}/items/ghost.override.ts`, target: "ghost" }]);
  assert.deepEqual(checkAdminMenu(snap, domains, routes), [
    `${base}/items/ghost.override.ts: 相手の ghost が受け口に無い上書き`,
  ]);
});

test("実リポ: 点検が通る(pnpm admin-menu:check と同じ)", async () => {
  assert.deepEqual(checkAdminMenu(await readMenuSnapshot(), adminDomains, readRoutePaths()), []);
});
