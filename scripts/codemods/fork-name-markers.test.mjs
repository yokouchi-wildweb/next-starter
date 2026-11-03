// scripts/codemods/fork-name-markers.test.mjs
// 実行: pnpm test:codemods(一時フォルダの fixture。git は使わない: 基準の版のファイルは引数で渡す)

import assert from "node:assert/strict";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { test } from "node:test";

import { applyMigration, planMigration, rewriteImports, splitAlwaysOn, stripMarker } from "./fork-name-markers.mjs";

const POINT = (dir) => `{ dir: "${dir}", export: "item", type: { from: "@/t", name: "T" }, side: "server" }`;

function fixture(files) {
  const root = mkdtempSync(join(tmpdir(), "fork-name-markers-"));
  for (const [path, text] of Object.entries(files)) {
    mkdirSync(dirname(join(root, path)), { recursive: true });
    writeFileSync(join(root, path), text);
  }
  return root;
}

const UPSTREAM = {
  "src/features/core/setting/extensionPoints.ts": `export const extensionPoints = { fields: ${POINT("fields")} };\n`,
  "src/features/core/setting/fields/a.ts": "export const item = 1;\n",
  "src/proxies/extensionPoints.ts": `export const extensionPoints = { handlers: ${POINT(".")}, rules: ${POINT("featureGateRules")} };\n`,
  "src/proxies/featureGateRules/wallet.ts": "export const item = 1;\n",
  "src/features/core/payment/enricher.default.ts": "export function enrich() {}\n",
  "src/features/core/payment/enricher.ts": 'export { enrich } from "./enricher.default";\n',
  "src/app/(user)/layout.tsx": 'export { UserLayout as default } from "./_layout/UserLayout";\n',
  "src/app/(user)/_layout/UserLayout.tsx": "export function UserLayout() {}\n",
  "src/app/(user)/_layout/Header/index.tsx": "export function Header() {}\n",
  "src/app/(user)/_layout/README.md": "# frame\n",
  "src/wiring/apiRoute.ts": "export const x = 1;\n",
  "scripts/tasks/run.ts": "// runner\n",
};
const BASE = Object.keys(UPSTREAM);

const FORK = {
  // 受け口の項目(ファイル・フォルダ形)
  "src/features/core/setting/fields/mine.acme.ts": "export const item = 1;\n",
  "src/features/core/setting/fields/folder.acme/index.ts": 'import { part } from "./part";\nexport const item = part;\n',
  "src/features/core/setting/fields/folder.acme/part.ts": "export const part = 1;\n",
  "src/proxies/throttle.parent.ts": "export const handler = 1;\n",
  // 衝突(上流の wallet と同じ単位)
  "src/proxies/featureGateRules/wallet.acme.ts": "export const item = 2;\n",
  // 1 行スイッチの fork の実装
  "src/features/core/payment/enricher.acme.ts": "export function enrich() {}\n",
  // route の隣: 既定の置き換えと fork だけの部品、食い違った印(.other)
  "src/app/(user)/_layout/UserLayout.acme.tsx": 'import { Bell } from "./Bell.other";\nimport { Header } from "./Header/index.acme";\nexport function UserLayout() { return [Bell, Header]; }\n',
  "src/app/(user)/_layout/Bell.other.tsx": "export function Bell() {}\n",
  "src/app/(user)/_layout/Header/index.acme.tsx": "export function Header() {}\n",
  "src/app/(user)/_layout/README.acme.md": "# fork notes\n",
  // tasks・wiring の直下(client の中置きは残す)
  "scripts/tasks/seed-names.acme.ts": "export const task = 1;\n",
  "src/wiring/storeMembers.acme.ts": "export const x = 1;\n",
  "src/wiring/AppExtras.client.acme.tsx": "export const y = 1;\n",
  // 拡張点の宣言の旧い形(止める)
  "src/features/core/user/extensionPoints.acme.ts": `export const extensionPoints = { badges: ${POINT("badges")} };\n`,
  // 場所の外の点つきの名前は触らない
  "src/config/app/foo.config.ts": "export const foo = 1;\n",
  "src/features/shop/services/server/shop.server.ts": 'import { enrich } from "@/features/core/payment/enricher.acme";\nexport const s = enrich;\n',
  "src/app/(user)/_layout/UserLayout.acme.test.tsx": "// test\n",
};

test("stripMarker: 印の語だけを外し、client・default・replace の中置きは残す。印が無ければ null", () => {
  assert.equal(stripMarker("mine.acme.ts").name, "mine.ts");
  assert.equal(stripMarker("AppExtras.client.acme.tsx").name, "AppExtras.client.tsx");
  assert.equal(stripMarker("walletAdjust.oripa-do", { folder: true }).name, "walletAdjust");
  assert.equal(stripMarker("seed.a.b.ts").marker, "a.b");
  assert.equal(stripMarker("plain.ts"), null);
  assert.equal(stripMarker("x.default.ts"), null);
  assert.equal(stripMarker("x.override.ts"), null);
});

test("planMigration: 各形の移行先、衝突と旧い宣言は止める、場所の外は触らない", () => {
  const root = fixture({ ...UPSTREAM, ...FORK });
  try {
    const plan = planMigration(root, { baseFiles: BASE });
    const map = Object.fromEntries(plan.changes.map((c) => [c.from, `${c.to} ${c.kind}`]));
    assert.deepEqual(map, {
      "src/features/core/setting/fields/mine.acme.ts": "src/features/core/setting/fields/mine.ts item",
      "src/features/core/setting/fields/folder.acme": "src/features/core/setting/fields/folder item",
      "src/proxies/throttle.parent.ts": "src/proxies/throttle.ts item",
      "src/features/core/payment/enricher.acme.ts": "src/features/core/payment/enricher.replace.ts switch",
      "src/app/(user)/_layout/UserLayout.acme.tsx": "src/app/(user)/_layout/UserLayout.replace.tsx route-replace",
      "src/app/(user)/_layout/Bell.other.tsx": "src/app/(user)/_layout/Bell.tsx route-part",
      "src/app/(user)/_layout/Header/index.acme.tsx": "src/app/(user)/_layout/Header/index.replace.tsx route-replace",
      "scripts/tasks/seed-names.acme.ts": "scripts/tasks/seed-names.ts task",
      "src/wiring/storeMembers.acme.ts": "src/wiring/storeMembers.ts wiring",
      "src/wiring/AppExtras.client.acme.tsx": "src/wiring/AppExtras.client.tsx wiring",
    });
    const stops = Object.fromEntries(plan.stops.map((s) => [s.path, s]));
    assert.deepEqual(Object.keys(stops).sort(), [
      "src/app/(user)/_layout/README.acme.md",
      "src/features/core/user/extensionPoints.acme.ts",
      "src/proxies/featureGateRules/wallet.acme.ts",
    ]);
    assert.match(stops["src/proxies/featureGateRules/wallet.acme.ts"].reason, /unit-clash/);
    assert.equal(stops["src/proxies/featureGateRules/wallet.acme.ts"].suggest, "src/proxies/featureGateRules/walletAcme.ts");
    assert.match(stops["src/features/core/user/extensionPoints.acme.ts"].reason, /fork 自身のフォルダ/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("衝突: 印を外した名前がほかの移行先・HEAD の印なしのファイルと重なっても止める。タスクの案は <名前>-<印>", () => {
  const root = fixture({
    ...UPSTREAM,
    "src/features/core/setting/fields/dup.acme.ts": "export const item = 1;\n",
    "src/features/core/setting/fields/dup.parent.ts": "export const item = 2;\n",
    "src/features/core/setting/fields/own.ts": "export const item = 3;\n",
    "src/features/core/setting/fields/own.acme.ts": "export const item = 4;\n",
    "scripts/tasks/run.acme.ts": "export const task = 1;\n",
  });
  try {
    const plan = planMigration(root, { baseFiles: BASE });
    assert.deepEqual(plan.changes, []);
    assert.deepEqual(plan.stops.map((s) => s.path), [
      "scripts/tasks/run.acme.ts",
      "src/features/core/setting/fields/dup.acme.ts",
      "src/features/core/setting/fields/dup.parent.ts",
      "src/features/core/setting/fields/own.acme.ts",
    ]);
    assert.equal(plan.stops[0].suggest, "scripts/tasks/run-acme.ts");
    assert.match(plan.stops[1].reason, /ほかの移行先と重なる/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("rewriteImports: @/ と相対、拡張子つき、フォルダの中から、移らないファイルは触らない", () => {
  const changes = [
    { from: "src/a/x.acme.ts", to: "src/a/x.ts" },
    { from: "src/f/item.acme", to: "src/f/item", folder: true },
  ];
  const text = 'import { x } from "@/a/x.acme";\nimport y from "../a/x.acme.ts";\nconst z = await import("@/f/item.acme/part");\nimport { q } from "@/a/other";\n';
  const out = rewriteImports(text, "src/b/use.ts", "src/b/use.ts", changes);
  assert.equal(out.text, 'import { x } from "@/a/x";\nimport y from "../a/x.ts";\nconst z = await import("@/f/item/part");\nimport { q } from "@/a/other";\n');
  assert.equal(rewriteImports('import { p } from "./part";\n', "src/f/item.acme/index.ts", "src/f/item/index.ts", changes).changed, false);
  assert.equal(rewriteImports('import { x } from "../../a/x.acme";\n', "src/f/item.acme/index.ts", "src/f/item/index.ts", changes).text, 'import { x } from "../../a/x";\n');
});

test("applyMigration: 改名・スイッチと枠の行・import の追従。2 回目は何もしない", () => {
  const root = fixture({ ...UPSTREAM, ...FORK, "src/features/core/payment/enricher.ts": 'export { enrich } from "./enricher.acme";\n', "src/app/(user)/layout.tsx": 'export { UserLayout as default } from "./_layout/UserLayout.acme";\n' });
  try {
    const plan = planMigration(root, { baseFiles: BASE });
    const applied = applyMigration(root, plan);
    assert.equal(applied.renamed, 10);
    assert.ok(existsSync(join(root, "src/features/core/setting/fields/folder/part.ts")));
    assert.ok(!existsSync(join(root, "src/features/core/setting/fields/folder.acme")));
    assert.equal(readFileSync(join(root, "src/features/core/payment/enricher.ts"), "utf8"), 'export { enrich } from "./enricher.replace";\n');
    assert.equal(readFileSync(join(root, "src/app/(user)/layout.tsx"), "utf8"), 'export { UserLayout as default } from "./_layout/UserLayout.replace";\n');
    assert.match(readFileSync(join(root, "src/app/(user)/_layout/UserLayout.replace.tsx"), "utf8"), /from "\.\/Bell";\nimport \{ Header \} from "\.\/Header\/index\.replace";/);
    assert.match(readFileSync(join(root, "src/features/shop/services/server/shop.server.ts"), "utf8"), /@\/features\/core\/payment\/enricher\.replace/);
    assert.ok(existsSync(join(root, "src/proxies/featureGateRules/wallet.acme.ts")), "衝突は書き換えない");
    assert.ok(existsSync(join(root, "src/config/app/foo.config.ts")));
    const again = planMigration(root, { baseFiles: BASE });
    assert.deepEqual(again.changes, []);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("常時実行の例外: alwaysOnExceptions.<印>.mjs を行ごとのファイルに分け、行のパスは改名に追従する", () => {
  const text = 'export const exceptions = [{ file: "src/wiring/storeMembers.acme.ts", reason: "結線だけ" }];\nexport const registries = [{ file: "src/registry/cleanup.ts", reason: "退会" }, { file: "src/registry/cleanup.ts", reason: "重複名" }];\n';
  const split = splitAlwaysOn(text, "scripts/proxies/alwaysOnExceptions.acme.mjs", [{ from: "src/wiring/storeMembers.acme.ts", to: "src/wiring/storeMembers.ts" }], []);
  assert.deepEqual(split.files.map((f) => f.path), [
    "scripts/proxies/alwaysOnExceptions/storeMembers.mjs",
    "scripts/proxies/alwaysOnExceptions/cleanup.mjs",
    "scripts/proxies/alwaysOnExceptions/cleanup2.mjs",
  ]);
  assert.match(split.files[0].text, /export const exception = \{\n {2}file: "src\/wiring\/storeMembers\.ts",\n {2}reason: "結線だけ"\n\};/);
  assert.match(split.files[1].text, /export const registry = /);
  assert.ok(splitAlwaysOn("export const exceptions = make();\n", "x.mjs", [], []).problem);

  const root = fixture({ ...UPSTREAM, "scripts/proxies/alwaysOnExceptions.acme.mjs": text, "src/wiring/storeMembers.acme.ts": "export const x = 1;\n" });
  try {
    const plan = planMigration(root, { baseFiles: BASE });
    assert.deepEqual(plan.alwaysOn.map((a) => a.from), ["scripts/proxies/alwaysOnExceptions.acme.mjs"]);
    const applied = applyMigration(root, plan);
    assert.equal(applied.alwaysOnFiles.length, 3);
    assert.ok(!existsSync(join(root, "scripts/proxies/alwaysOnExceptions.acme.mjs")));
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
