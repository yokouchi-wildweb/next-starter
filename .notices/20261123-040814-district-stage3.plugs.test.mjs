// .notices/20261123-040814-district-stage3.plugs.test.mjs
// 実行: pnpm test .notices(一時フォルダの fixture。git は使わない)

import assert from "node:assert/strict";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { test } from "node:test";

import { applyPlugs, destinationOf, domainByName, plugsNameOf, planPlugs, rewriteDeclaration, rewriteRelativeImports } from "./20261123-040814-district-stage3.plugs.mjs";
import { readDeclaration } from "../src/lib/districtMap/index.mjs";

function fixture(files, { fork = false } = {}) {
  const root = mkdtempSync(join(tmpdir(), "stage3-plugs-"));
  const all = {
    "repo.json": JSON.stringify({ repo_id: fork ? "acme" : "next-starter", tier: fork ? "leaf" : "root" }),
    "src/lib/CATALOG.md": fork ? "# x\n\n## next-starter\n\n## acme\n" : "# x\n\n## next-starter\n",
    ".notices/applied/next-starter.md": "",
    ...files,
  };
  for (const [path, text] of Object.entries(all)) {
    mkdirSync(dirname(join(root, path)), { recursive: true });
    writeFileSync(join(root, path), text);
  }
  return root;
}

const DOMAINS = ["user", "userGroup", "wallet", "walletHistory", "coupon", "messaging"];

test("点の名前: 持ち主の名前で始める(既に始まる名前・adminBulkActions はそのまま)", () => {
  assert.equal(plugsNameOf("src/domains/core/user", "cleanupHandlers"), "userCleanupHandlers");
  assert.equal(plugsNameOf("src/domains/core/setting", "fields"), "settingFields");
  assert.equal(plugsNameOf("src/domains/core/admin", "menuItems"), "adminMenuItems");
  assert.equal(plugsNameOf("src/domains/core/user", "userTags"), "userTags", "既に持ち主の名前で始まる");
  assert.equal(plugsNameOf("src/domains/core/user", "users"), "userUsers", "持ち主の名前の後が小文字なら始まっていない");
  assert.equal(plugsNameOf("src/domains/sample", "adminBulkActions"), "adminBulkActions");
});

test("行き先: 名前が指すドメイン(一番長い・複数形・大文字の境)へ、無ければ持ち主のまま。読むドメインは行き先にしない(reads に出す、D38)", () => {
  assert.equal(domainByName("walletAdjusted", DOMAINS), "wallet");
  assert.equal(domainByName("walletHistoryEntry", DOMAINS), "walletHistory", "一番長い名前");
  assert.equal(domainByName("coupons", DOMAINS), "coupon");
  assert.equal(domainByName("userGroups", DOMAINS), "userGroup");
  assert.equal(domainByName("usersGeneral", DOMAINS), "user");
  assert.equal(domainByName("wallets2", DOMAINS), null, "大文字の境でない");
  assert.equal(domainByName("couponish", DOMAINS), null);
  assert.equal(domainByName("pricePlanCategories", ["pricePlan", "pricePlanCategory"]), "pricePlanCategory", "y → ies の複数形(注文 40、TriQ)");
  assert.deepEqual(destinationOf({ owner: "user", item: "wallet", texts: ['import { a } from "@/domains/wallet/services/server";\n'], domains: DOMAINS }), { to: "wallet", rule: "name", reads: ["wallet"] });
  assert.deepEqual(destinationOf({ owner: "userGroup", item: "hasTag", texts: ['import type { U } from "@/domains/user/types";\nconst x = await import("@/domains/core/wallet");\n'], domains: DOMAINS }), { to: "userGroup", rule: "owner", reads: ["user", "wallet"] });
  assert.deepEqual(destinationOf({ owner: "user", item: "userTags", texts: [], domains: DOMAINS }), { to: "user", rule: "owner", reads: [] }, "名前が持ち主なら持ち主");
});

const DECL = (owner, body) => [`src/domains/core/${owner}/extensionPoints.ts`, `export const extensionPoints = {\n${body}\n};\n`];

function tree(extra = {}, options) {
  return fixture(
    Object.fromEntries([
      DECL("user", '  // 後始末\n  cleanupHandlers: { change: "add", dir: "cleanupHandlers", export: "handler", type: { from: "@/x", name: "H" }, side: "server" },\n  adminBulkActions: { change: "add", dir: "adminBulkActions", export: "action", type: { from: "@/lib/tableSuite", name: "BulkAction" }, side: "client", overrideOf: ["label"] },'),
      DECL("messaging", '  adminBulkActions: { change: "add", dir: "adminBulkActions", export: "action", type: { from: "@/lib/tableSuite", name: "BulkAction" }, side: "client", overrideOf: ["label"] },'),
      DECL("admin", '  menuItems: { change: "add", dir: "menu/items", export: "item", type: { from: "@/x", name: "M" }, side: "client", overrideOf: ["label"] },'),
      ["src/domains/core/user/cleanupHandlers/wallet.ts", 'import { w } from "@/domains/wallet/services/server";\nexport const handler = w;\n'],
      ["src/domains/core/user/cleanupHandlers/sessions.ts", "export const handler = 1;\n"],
      ["src/domains/core/user/cleanupHandlers/sessions.test.ts", "test;\n"],
      ["src/domains/core/user/cleanupHandlers/all.test.ts", "test;\n"],
      ["src/domains/core/user/cleanupHandlers/README.md", "# x\n"],
      ["src/domains/core/user/adminBulkActions/userTags.tsx", "export const action = 1;\n"],
      ["src/domains/core/messaging/adminBulkActions/delete.tsx", "export const action = 1;\n"],
      ["src/domains/core/admin/menu/items/coupons.ts", "export const item = 1;\n"],
      ["src/domains/core/admin/menu/items/coupons.override.ts", "export const override = { label: 'x' };\n"],
      ["src/domains/core/admin/menu/items/dataMenu.ts", "export const item = 1;\n"],
      ["src/domains/core/wallet/index.ts", "export {};\n"],
      ["src/domains/core/coupon/index.ts", "export {};\n"],
      ["src/domains/core/wallet/messages/expired.ts", "export const message = 1;\n"],
      ...Object.entries(extra),
    ]),
    options,
  );
}

test("計画: 点の書き換え(名前・adminBulkActions を admin の 1 点に)、項目の行き先、一緒に動く物と残る物、登録表の項目", () => {
  const plan = planPlugs(tree());
  assert.deepEqual(
    plan.conversions.map((c) => `${c.owner}:${c.from}→${c.merged ?? c.to}${c.features.length ? `[${c.features.join(",")}]` : ""}`),
    [
      "src/domains/core/admin:menuItems→adminMenuItems",
      "src/domains/core/messaging:adminBulkActions→src/domains/core/admin",
      "src/domains/core/user:adminBulkActions→src/domains/core/admin",
      "src/domains/core/user:cleanupHandlers→userCleanupHandlers",
    ],
  );
  assert.deepEqual(
    plan.moves.map((m) => `${m.from}→${m.to}(${m.rule})`),
    [
      "src/domains/core/admin/menu/items/coupons.ts→src/domains/core/coupon/plugs/adminMenuItems/coupons.ts(name)",
      "src/domains/core/admin/menu/items/dataMenu.ts→src/domains/core/admin/plugs/adminMenuItems/dataMenu.ts(owner)",
      "src/domains/core/messaging/adminBulkActions/delete.tsx→src/domains/core/messaging/plugs/adminBulkActions/delete.tsx(list)",
      "src/domains/core/user/adminBulkActions/userTags.tsx→src/domains/core/user/plugs/adminBulkActions/userTags.tsx(list)",
      "src/domains/core/user/cleanupHandlers/sessions.ts→src/domains/core/user/plugs/userCleanupHandlers/sessions.ts(owner)",
      "src/domains/core/user/cleanupHandlers/wallet.ts→src/domains/core/wallet/plugs/userCleanupHandlers/wallet.ts(name)",
    ],
  );
  assert.deepEqual(plan.moves[0].companions, [{ from: "src/domains/core/admin/menu/items/coupons.override.ts", to: "src/domains/core/coupon/plugs/adminMenuItems/coupons.override.ts" }]);
  assert.deepEqual(plan.moves.find((m) => m.from.endsWith("sessions.ts"))?.companions.map((c) => c.to), ["src/domains/core/user/plugs/userCleanupHandlers/sessions.test.ts"]);
  assert.deepEqual(plan.leftovers, ["src/domains/core/user/cleanupHandlers/README.md", "src/domains/core/user/cleanupHandlers/all.test.ts"]);
  assert.deepEqual(plan.registry, [
    { domain: "wallet", folder: "messages", from: "src/domains/core/wallet/messages", to: "src/domains/core/wallet/plugs/messages", merge: false, items: ["src/domains/core/wallet/messages/expired.ts"] },
  ]);
  assert.deepEqual(plan.stops, []);
});

test("当て: 項目と一緒に動く物を移し、宣言を書き換え(鍵・dir → plugs: true)、adminBulkActions は admin の 1 点に。空になった宣言とフォルダは消す。2 回目は何もしない", () => {
  const root = tree();
  applyPlugs(root, planPlugs(root));
  assert.ok(existsSync(join(root, "src/domains/core/wallet/plugs/userCleanupHandlers/wallet.ts")));
  assert.ok(existsSync(join(root, "src/domains/core/coupon/plugs/adminMenuItems/coupons.override.ts")));
  assert.ok(!existsSync(join(root, "src/domains/core/admin/menu")), "空になったフォルダは消す");
  assert.ok(existsSync(join(root, "src/domains/core/user/cleanupHandlers/README.md")), "残る物はそのまま(26 で片付ける)");
  const user = readFileSync(join(root, "src/domains/core/user/extensionPoints.ts"), "utf8");
  assert.match(user, /\/\/ 後始末\n {2}userCleanupHandlers: \{ change: "add", plugs: true, export: "handler"/);
  assert.doesNotMatch(user, /adminBulkActions/);
  assert.ok(!existsSync(join(root, "src/domains/core/messaging/extensionPoints.ts")), "点が無くなった宣言は消す");
  const admin = readFileSync(join(root, "src/domains/core/admin/extensionPoints.ts"), "utf8");
  assert.match(admin, /adminMenuItems: \{ change: "add", plugs: true,/);
  assert.match(admin, /adminBulkActions: \{ change: "add", plugs: true, export: "action"/);
  for (const path of ["src/domains/core/user/extensionPoints.ts", "src/domains/core/admin/extensionPoints.ts"]) assert.deepEqual(readDeclaration(path, readFileSync(join(root, path), "utf8")).problems, [], path);
  assert.ok(existsSync(join(root, "src/domains/core/wallet/plugs/messages/expired.ts")), "登録表の項目のフォルダは plugs/ の下へ(注文 29)");
  assert.ok(!existsSync(join(root, "src/domains/core/wallet/messages")));
  const again = planPlugs(root);
  assert.deepEqual([again.conversions, again.moves, again.registry], [[], [], []]);
});

test("fork: 上流の受け口の fork の項目は自分のドメインへ。行き先が上流の場所(コアドメイン・lib)なら止め、--owner で決める", () => {
  const files = {
    "src/domains/core/user/cleanupHandlers/couponExtra.ts": "export const handler = 1;\n",
    "src/domains/core/user/cleanupHandlers/acmeShop.ts": "export const handler = 1;\n",
    "src/domains/acmeShop/index.ts": "export {};\n",
  };
  const plan = planPlugs(tree(files, { fork: true }));
  const move = (from) => plan.moves.find((m) => m.from === from)?.to;
  assert.equal(move("src/domains/core/user/cleanupHandlers/acmeShop.ts"), "src/domains/acmeShop/plugs/userCleanupHandlers/acmeShop.ts");
  assert.ok(plan.stops.some((s) => s.path.endsWith("couponExtra.ts") && /上流の場所/.test(s.text)));
  const given = planPlugs(tree(files, { fork: true }), { owners: { "src/domains/core/user/cleanupHandlers/couponExtra.ts": "src/domains/acmeShop" } });
  assert.equal(given.moves.find((m) => m.from.endsWith("couponExtra.ts"))?.to, "src/domains/acmeShop/plugs/userCleanupHandlers/couponExtra.ts");
});

test("宣言の書き換えの単体: 点の前の行コメントごと消し、ほかの点の字下げとコメントは保つ", () => {
  const text = 'export const extensionPoints = {\n  // 残す\n  keep: { change: "add", dir: "k", export: "a", type: { from: "@/x", name: "A" }, side: "server" },\n  // 消す\n  gone: { change: "add", dir: "g", export: "b", type: { from: "@/x", name: "B" }, side: "server" },\n};\n';
  const out = rewriteDeclaration("a/extensionPoints.ts", text, { rename: new Map([["keep", "ownerKeep"]]), remove: new Set(["gone"]) });
  assert.equal(out.text, 'export const extensionPoints = {\n  // 残す\n  ownerKeep: { change: "add", plugs: true, export: "a", type: { from: "@/x", name: "A" }, side: "server" },\n};\n');
  assert.equal(out.left, 1);
  assert.match(out.removedSpecs.gone, /dir: "g"/);
  const wrapped = rewriteDeclaration("a/extensionPoints.ts", text.replace(/\n};\n$/, "\n} as const;\n"), { rename: new Map(), remove: new Set(["gone"]) });
  assert.equal(wrapped.left, 1, "as const の包みも読む");
  assert.doesNotMatch(wrapped.text, /gone/);
});

test("1 つのフォルダを読む点(連絡のレイアウト): 主の点の項目のフォルダを 1 回だけ動かし、ほかの点は itemsOf。中の差替点の既定のパスも書き換える(注文 25)", () => {
  const T = (n) => `{ from: "@/x", name: "${n}" }`;
  const root = fixture({
    "src/domains/core/messaging/extensionPoints.ts": `export const extensionPoints = {
  layouts: { change: "add", dir: "layouts", files: "*/layout.ts", export: "layout", type: ${T("L")}, side: "server", key: "key", overrideOf: ["disabled"] },
  layoutEmails: { change: "add", dir: "layouts", files: "*/email.tsx", export: "emailRenderer", type: ${T("E")}, side: "server", key: "layout" },
  alertEmail: { change: "replace", default: "src/domains/core/messaging/layouts/alert/AlertEmail.default.tsx", type: { from: "@/domains/core/messaging/layouts/alert/AlertEmail.default", name: "AlertEmailProps" }, side: "server" },
};
`,
    "src/domains/core/messaging/layouts/alert/layout.ts": 'export const layout = { key: "alert" };\n',
    "src/domains/core/messaging/layouts/alert/email.tsx": 'export const emailRenderer = { layout: "alert" };\n',
    "src/domains/core/messaging/layouts/alert/AlertEmail.tsx": 'export { AlertEmail } from "./AlertEmail.default";\n',
    "src/domains/core/messaging/layouts/alert/AlertEmail.default.tsx": "export type AlertEmailProps = {};\nexport function AlertEmail() { return null; }\n",
    "src/domains/core/messaging/layouts/README.md": "# x\n",
  });
  const plan = planPlugs(root);
  assert.deepEqual(plan.conversions.map((c) => `${c.from}→${c.to}${c.itemsOf ? `(itemsOf ${c.itemsOf})` : ""}`), ["layoutEmails→messagingLayoutEmails(itemsOf messagingLayouts)", "layouts→messagingLayouts"]);
  assert.deepEqual(plan.moves.map((m) => `${m.from}→${m.to}`), ["src/domains/core/messaging/layouts/alert→src/domains/core/messaging/plugs/messagingLayouts/alert"]);
  assert.deepEqual(plan.replaces.map((r) => r.point), ["alertEmail"]);
  applyPlugs(root, plan);
  const decl = readFileSync(join(root, "src/domains/core/messaging/extensionPoints.ts"), "utf8");
  assert.match(decl, /messagingLayoutEmails: \{ change: "add", plugs: true, itemsOf: "messagingLayouts", files: "\*\/email\.tsx"/);
  assert.match(decl, /default: "src\/domains\/core\/messaging\/plugs\/messagingLayouts\/alert\/AlertEmail\.default\.tsx", type: \{ from: "@\/domains\/core\/messaging\/plugs\/messagingLayouts\/alert\/AlertEmail\.default"/);
  assert.deepEqual(readDeclaration("src/domains/core/messaging/extensionPoints.ts", decl).problems, []);
  assert.ok(existsSync(join(root, "src/domains/core/messaging/plugs/messagingLayouts/alert/AlertEmail.default.tsx")));
});

test("--only: 挙げた持ち主の点だけ。adminBulkActions はどれかの持ち主か core/admin を挙げれば全部の持ち主を一度に", () => {
  const root = tree();
  const names = (only) => planPlugs(root, { only }).conversions.map((c) => `${c.owner.replace("src/domains/core/", "")}:${c.from}`);
  assert.deepEqual(names(["src/domains/core/admin"]), ["admin:menuItems", "messaging:adminBulkActions", "user:adminBulkActions"]);
  assert.deepEqual(names(["src/domains/core/user"]), ["messaging:adminBulkActions", "user:adminBulkActions", "user:cleanupHandlers"]);
  assert.deepEqual(names(["src/domains/core/wallet"]), []);
  assert.deepEqual(planPlugs(root, { only: ["src/domains/core/admin"] }).moves.map((m) => m.from.replace("src/domains/core/", "")), [
    "admin/menu/items/coupons.ts",
    "admin/menu/items/dataMenu.ts",
    "messaging/adminBulkActions/delete.tsx",
    "user/adminBulkActions/userTags.tsx",
  ]);
});

test("動かした項目の相対の import: 元の場所から解いて src の下は @/ に、フォルダの項目の中はそのまま(注文 27)", () => {
  const text = [
    'import type { X } from "../types";',
    'import { y } from "../../utils/userFilter";',
    'import { z } from "./parts/z";',
    'const m = await import("../lazy");',
    'import { k } from "@/lib/k";',
  ].join("\n");
  const out = rewriteRelativeImports(
    text,
    "src/domains/core/analytics/services/server/coinIssuance/sources/gap/index.ts",
    "src/domains/core/wallet/plugs/analyticsCoinIssuanceSources/gap/index.ts",
    "src/domains/core/analytics/services/server/coinIssuance/sources/gap",
  );
  assert.equal(
    out,
    [
      'import type { X } from "@/domains/core/analytics/services/server/coinIssuance/sources/types";',
      'import { y } from "@/domains/core/analytics/services/server/coinIssuance/utils/userFilter";',
      'import { z } from "./parts/z";',
      'const m = await import("@/domains/core/analytics/services/server/coinIssuance/sources/lazy");',
      'import { k } from "@/lib/k";',
    ].join("\n"),
  );
});

test("登録表の項目のフォルダ(注文 29): messages・recordTargets をフォルダごと plugs/ へ、中の相対の import を書き直す。行き先があれば中身を合わせ同じ名前なら止める、--only はそのドメインだけ", () => {
  const files = {
    "src/domains/shop/messages/orderPlaced.ts": 'import { fmt } from "../utils/fmt";\nimport { sub } from "./parts/sub";\nexport const message = 1;\n',
    "src/domains/shop/messages/orderPlaced.override.ts": "export const messageOverride = {};\n",
    "src/domains/shop/messages/parts/sub.ts": "export const sub = 1;\n",
    "src/domains/shop/recordTargets/orders.ts": "export const recordTarget = 1;\n",
    "src/domains/shop/utils/fmt.ts": "export const fmt = 1;\n",
    "src/domains/blog/messages/posted.ts": "export const message = 1;\n",
    "src/domains/blog/plugs/messages/old.ts": "export const message = 1;\n",
    "src/domains/news/messages/posted.ts": "export const message = 1;\n",
    "src/domains/news/plugs/messages/posted.ts": "export const message = 2;\n",
  };
  const root = fixture(files, { fork: true });
  const only = planPlugs(root, { only: ["src/domains/shop"] });
  assert.deepEqual(only.registry.map((r) => `${r.from}→${r.to}`), ["src/domains/shop/messages→src/domains/shop/plugs/messages", "src/domains/shop/recordTargets→src/domains/shop/plugs/recordTargets"]);
  const plan = planPlugs(root);
  assert.deepEqual(plan.stops.map((s) => s.path), ["src/domains/news/messages"]);
  applyPlugs(root, plan);
  const moved = readFileSync(join(root, "src/domains/shop/plugs/messages/orderPlaced.ts"), "utf8");
  assert.match(moved, /from "@\/domains\/shop\/utils\/fmt"/);
  assert.match(moved, /from "\.\/parts\/sub"/);
  assert.ok(existsSync(join(root, "src/domains/shop/plugs/messages/orderPlaced.override.ts")));
  assert.ok(existsSync(join(root, "src/domains/shop/plugs/recordTargets/orders.ts")));
  assert.ok(existsSync(join(root, "src/domains/blog/plugs/messages/posted.ts")), "行き先があれば中身を合わせる");
  assert.ok(existsSync(join(root, "src/domains/blog/plugs/messages/old.ts")));
  assert.ok(!existsSync(join(root, "src/domains/blog/messages")));
  assert.ok(existsSync(join(root, "src/domains/news/messages/posted.ts")), "同じ名前がある物は止めて動かさない");
});
