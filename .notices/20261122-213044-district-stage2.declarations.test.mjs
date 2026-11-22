// .notices/20261122-213044-district-stage2.declarations.test.mjs
// 実行: pnpm test .notices(一時フォルダの fixture。git は使わない)

import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { test } from "node:test";

import { addChanges, addPoint, applyDeclarations, contractTypeOf, planDeclarations, replacePlanOf, rewriteRule } from "./20261122-213044-district-stage2.declarations.mjs";
import { readDeclaration } from "../src/lib/districtMap/index.mjs";

function fixture(files) {
  const root = mkdtempSync(join(tmpdir(), "declarations-"));
  for (const [path, text] of Object.entries(files)) {
    mkdirSync(dirname(join(root, path)), { recursive: true });
    writeFileSync(join(root, path), text);
  }
  return root;
}

const DECL = `export const extensionPoints = {
  // 受け口
  items: { dir: "items", export: "item", type: { from: "@/x", name: "X" }, side: "server" },
  roles: { writer: "role:generate", side: "shared" },
  targets: {
    overrides: "src/domains/x/a/*.json",
    export: "override",
    side: "server",
    overrideOf: ["label"],
  },
  icon: { placement: "src/app/icon.png", kind: "edit" },
  done: { change: "add", dir: "done", export: "d", type: { from: "@/x", name: "D" }, side: "client" },
} as const;
`;

test("欄から change を書き足す: 1 行の点は { の直後、複数行の点は最初の欄の字下げで。change のある点は触らない", () => {
  const { text, added, stops } = addChanges("src/domains/x/extensionPoints.ts", DECL);
  assert.deepEqual(stops, []);
  assert.deepEqual(added, [
    { point: "items", change: "add" },
    { point: "roles", change: "add" },
    { point: "targets", change: "override" },
    { point: "icon", change: "counterpart" },
  ]);
  assert.match(text, /items: \{ change: "add", dir: "items"/);
  assert.match(text, /roles: \{ change: "add", writer:/);
  assert.match(text, /targets: \{\n {4}change: "override",\n {4}overrides:/);
  assert.match(text, /icon: \{ change: "counterpart", placement:/);
  assert.match(text, /done: \{ change: "add", dir: "done"/);
  assert.equal(addChanges("src/domains/x/extensionPoints.ts", text).added.length, 0, "2 回目は何も足さない");
});

test("止める物: 宣言が無い・点が object のリテラルでない", () => {
  assert.equal(addChanges("a/extensionPoints.ts", "export const other = {};\n").stops.length, 1);
  const bad = addChanges("a/extensionPoints.ts", 'const d = "x";\nexport const extensionPoints = { a: { dir: d, export: "a" }, b: 1 };\n');
  assert.deepEqual(bad.stops.map((s) => s.point), ["a", "b"]);
  assert.equal(bad.added.length, 0);
});

test("計画と当て: src の下の extensionPoints.ts だけ(extensions/ の中は見ない)、2 回目は何も書かない", () => {
  const root = fixture({
    "src/domains/x/extensionPoints.ts": DECL,
    "src/lib/y/extensionPoints.ts": 'export const extensionPoints = { a: { default: "src/lib/y/a.default.ts", type: { from: "@/y", name: "A" }, side: "server" } };\n',
    "src/domains/x/extensions/extensionPoints.ts": "not a declaration",
    "scripts/extensionPoints.ts": "export const extensionPoints = { z: { dir: \"z\" } };\n",
  });
  const plan = planDeclarations(root);
  assert.equal(plan.files, 2);
  assert.deepEqual(plan.edits.map((e) => [e.path, e.added.map((a) => a.change)]), [
    ["src/domains/x/extensionPoints.ts", ["add", "add", "override", "counterpart"]],
    ["src/lib/y/extensionPoints.ts", ["replace"]],
  ]);
  applyDeclarations(root, plan);
  assert.match(readFileSync(join(root, "src/lib/y/extensionPoints.ts"), "utf8"), /a: \{ change: "replace", default:/);
  assert.deepEqual(planDeclarations(root).edits, []);
});

// ---- 差替点(注文 16): 宣言の無い 1 行スイッチの既定に差替点を足す ----

const DISTRICTS = [
  { name: "x", kind: "domains", dir: "src/domains/x" },
  { name: "mail", kind: "lib", dir: "src/lib/mail" },
  { name: "root", kind: "frame", dir: "src/app/_layout" },
  { name: "admin", kind: "frame", dir: "src/app/admin/_layout" },
];

test("差替点の計画: 持ち主 = 既定を中に持つ一番深い地区、名前 = スイッチの名前の先頭を小文字、型と側を既定から読む", () => {
  const plan = replacePlanOf("src/app/admin/_layout/Head.default.tsx", '"use client";\nexport type HeadProps = { a: 1 };\nexport function Head() {}\n', DISTRICTS);
  assert.deepEqual(plan, {
    declaration: "src/app/admin/_layout/extensionPoints.ts",
    point: "head",
    spec: { change: "replace", default: "src/app/admin/_layout/Head.default.tsx", type: { from: "@/app/admin/_layout/Head.default", name: "HeadProps" }, side: "client" },
  });
  assert.equal(replacePlanOf("src/domains/x/services/server/hook.default.ts", "export type Hook = () => void;\nexport const hook: Hook = () => {};\n", DISTRICTS).spec.side, "server");
});

test("約束の型: <名前>Props → ただ 1 つの export type → export const <x>: <T> の import type の元(相対は @/ に直す)", () => {
  assert.deepEqual(contractTypeOf("src/domains/x/a/A.default.tsx", "export type AProps = {};\nexport type Other = 1;\n", "A"), { from: "@/domains/x/a/A.default", name: "AProps" });
  assert.deepEqual(contractTypeOf("src/domains/x/a/b.default.ts", "export type Only = 1;\n", "b"), { from: "@/domains/x/a/b.default", name: "Only" });
  assert.deepEqual(contractTypeOf("src/domains/x/s/server/e.default.ts", 'import type { Enricher } from "../types/enricher";\nexport const e: Enricher | null = null;\n', "e"), { from: "@/domains/x/s/types/enricher", name: "Enricher" });
  assert.deepEqual(contractTypeOf("src/domains/x/c.default.ts", 'import type { Conf } from "@/domains/x/types";\nexport const c: Conf | null = null;\n', "c"), { from: "@/domains/x/types", name: "Conf" });
  assert.match(contractTypeOf("src/domains/x/d.default.ts", "export type P = 1;\nexport type Q = 2;\n", "d").stop, /候補: P \/ Q/);
});

test("差替点の止める物: 持ち主の無い既定(src/app は枠の候補)・側が決まらない。--owner・--side で人が決めれば通る", () => {
  const free = replacePlanOf("src/app/_providers/P.default.tsx", "export type PProps = {};\n", DISTRICTS);
  assert.match(free.stop, /持ち主の地区が無い.*候補: src\/app\/_layout\/extensionPoints\.ts/);
  const given = replacePlanOf("src/app/_providers/P.default.tsx", "export type PProps = {};\n", DISTRICTS, { owner: "src/app/_layout/extensionPoints.ts", side: "shared" });
  assert.equal(given.declaration, "src/app/_layout/extensionPoints.ts");
  assert.equal(given.spec.side, "shared");
  assert.match(replacePlanOf("src/lib/mail/frame/F.default.tsx", "export type FProps = {};\n", DISTRICTS).stop, /side が決まらない.*--side/);
  assert.match(replacePlanOf("src/lib/mail/frame/F.default.tsx", "export type FProps = {};\n", DISTRICTS, { side: "both" }).stop, /client \| server \| shared/);
});

test("宣言に点を足す: 最後の点の後ろ(, が無ければ足す)、as const の宣言も、空の宣言も。足した宣言は読み手が読める", () => {
  const spec = { change: "replace", default: "src/domains/x/a.default.ts", type: { from: "@/domains/x/a.default", name: "AProps" }, side: "server" };
  for (const text of [
    'export const extensionPoints = {\n  items: { change: "add", dir: "items", export: "i", type: { from: "@/x", name: "X" }, side: "server" }\n} as const;\n',
    'export const extensionPoints = {\n  items: { change: "add", dir: "items", export: "i", type: { from: "@/x", name: "X" }, side: "server" },\n};\n',
    "export const extensionPoints = {};\n",
  ]) {
    const added = addPoint("src/domains/x/extensionPoints.ts", text, "a", spec);
    const read = readDeclaration("src/domains/x/extensionPoints.ts", added.text);
    assert.deepEqual(read.problems, [], added.text);
    assert.deepEqual(read.points.a, spec);
  }
  assert.match(addPoint("x/extensionPoints.ts", "export const other = {};\n", "a", spec).problem, /extensionPoints/);
});

test("計画と当て(差替点): 宣言の無い既定に足し、宣言のファイルが無ければ作る。宣言済み・名乗りのある既定は触らない。2 回目は何も足さない。同じ名前の点は止める", () => {
  const root = fixture({
    "src/domains/x/index.ts": "export {};\n",
    "src/domains/x/services/server/hook.default.ts": "export type Hook = () => void;\nexport const hook: Hook = () => {};\n",
    "src/domains/x/services/server/done.default.ts": "export type Done = 1;\n",
    "src/domains/x/extensionPoints.ts": 'export const extensionPoints = {\n  done: { change: "replace", default: "src/domains/x/services/server/done.default.ts", type: { from: "@/t", name: "Done" }, side: "server" },\n};\n',
    "src/domains/y/index.ts": "export {};\n",
    "src/domains/y/server/w.default.ts": "export type WProps = {};\n",
    "src/domains/y/client/hook.default.ts": '"use client";\nexport type HookProps = {};\n',
    "src/domains/y/client/w.default.ts": '"use client";\nexport type WProps = {};\n',
    "src/app/(user)/a/frame.default.ts": "export const frameDefault = {};\n",
  });
  const plan = planDeclarations(root);
  assert.deepEqual(plan.replaces.map((r) => `${r.declaration}:${r.point}`), ["src/domains/x/extensionPoints.ts:hook", "src/domains/y/extensionPoints.ts:hook", "src/domains/y/extensionPoints.ts:w"]);
  assert.deepEqual(plan.stops.map((s) => [s.path, s.point]), [["src/domains/y/server/w.default.ts", "w"]], "同じ宣言に同じ名前の点は止める");
  const result = applyDeclarations(root, plan);
  assert.deepEqual(result.created, ["src/domains/y/extensionPoints.ts"]);
  for (const path of ["src/domains/x/extensionPoints.ts", "src/domains/y/extensionPoints.ts"]) assert.deepEqual(readDeclaration(path, readFileSync(join(root, path), "utf8")).problems, []);
  const again = planDeclarations(root);
  assert.deepEqual(again.replaces, []);
  assert.equal(again.stops.length, 1);
});

// ---- 門番の規則の書き直し(注文 20): 値の import + enabled: () => <名前> → when ----

const SHOP_CONFIG = { path: "src/domains/core/shop/config.ts", text: "export const shopConfig = { a: 1 };\nexport const open: boolean = shopConfig.a === 1;\n" };
const readShop = (domain) => (domain === "shop" ? SHOP_CONFIG : null);

test("規則の書き直し: import { <名前> } from config + enabled: () => <名前> は when に、import を外し前のコメントは残す。値の import の無い規則は null", () => {
  const before = '// 規則の説明\n\nimport { open } from "@/domains/core/shop/config";\n\nimport type { FeatureGateRule } from "@/featureGate";\n\nexport const rule: FeatureGateRule = {\n  pathPatterns: ["/shop"],\n  enabled: () => open,\n  defaultEnabled: true,\n};\n';
  const result = rewriteRule("src/featureGate/rules/shop.ts", before, readShop);
  assert.deepEqual(result.when, ["shop.open"]);
  assert.equal(result.text, '// 規則の説明\n\nimport type { FeatureGateRule } from "@/featureGate";\n\nexport const rule: FeatureGateRule = {\n  pathPatterns: ["/shop"],\n  when: ["shop.open"],\n  defaultEnabled: true,\n};\n');
  assert.equal(rewriteRule("src/featureGate/rules/shop.ts", result.text, readShop), null);
  assert.equal(rewriteRule("x.ts", 'export const rule = { enabled: () => process.env.X === "1" };\n', readShop), null, "環境変数は書き直さない");
});

test("規則の書き直しの止める物: 真偽でない値・式・住所の組み立て・ほかの import・when が既にある・config.ts が無い", () => {
  const stop = (text) => rewriteRule("x.ts", text, readShop).stop ?? "";
  assert.match(stop('import { shopConfig } from "@/domains/shop/config";\nexport const rule = { enabled: () => shopConfig.a === 1 };\n'), /自動で直せない.*shop\.shopConfig/);
  assert.match(stop('import { shopConfig } from "@/domains/shop/config";\nexport const rule = { enabled: () => shopConfig };\n'), /最上位の真偽の export でない/);
  assert.match(stop('import { shopConfig } from "@/domains/shop/config";\nconst slugs = shopConfig.list;\nexport const rule = { pathPatterns: slugs };\n'), /\* で/);
  assert.match(stop('import { helper } from "@/lib/x";\nexport const rule = { enabled: () => helper() };\n'), /@\/lib\/x を手で外す/);
  assert.match(stop('import { open } from "@/domains/shop/config";\nexport const rule = { when: ["shop.open"], enabled: () => open };\n'), /自動で直せない/);
  assert.match(stop('import { on } from "@/domains/nowhere/config";\nexport const rule = { enabled: () => on };\n'), /config\.ts が無い/);
});

test("計画と当て(規則): src/featureGate/rules の書き直しを計画に載せ、--apply で書く。2 回目は 0 本", () => {
  const root = fixture({
    "src/domains/core/shop/config.ts": SHOP_CONFIG.text,
    "src/featureGate/rules/shop.ts": 'import { open } from "@/domains/core/shop/config";\nexport const rule = { pathPatterns: ["/s"], enabled: () => open, defaultEnabled: true };\n',
    "src/featureGate/rules/plain.ts": 'export const rule = { pathPatterns: ["/p"], defaultEnabled: true };\n',
  });
  const plan = planDeclarations(root);
  assert.deepEqual(plan.rules.map((r) => [r.path, r.when]), [["src/featureGate/rules/shop.ts", ["shop.open"]]]);
  applyDeclarations(root, plan);
  assert.match(readFileSync(join(root, "src/featureGate/rules/shop.ts"), "utf8"), /^export const rule = \{ pathPatterns: \["\/s"\], when: \["shop\.open"\], defaultEnabled: true \};/);
  assert.deepEqual(planDeclarations(root).rules, []);
});
