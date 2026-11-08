// src/lib/districtMap/districtMap.test.mjs — 地区の地図の読み手を、注入した小さな木で確かめる(node:fs を使わない)
// 実行: pnpm test src/lib/districtMap(今の木との照合は scripts/structure/district-map/districtMap.test.mjs)
import assert from "node:assert/strict";
import { test } from "node:test";

import { readDistrictMap, readDomainEntry, readFrameName, readRuleFeatures, readTableNames, toJsonl } from "./index.mjs";

/** パス → 本文 の表から source を作る(フォルダはパスから導く) */
function memorySource(files) {
  const paths = Object.keys(files);
  return {
    listDir(rel) {
      const prefix = `${rel}/`;
      const names = new Map();
      for (const path of paths) {
        if (!path.startsWith(prefix)) continue;
        const [head, ...rest] = path.slice(prefix.length).split("/");
        names.set(head, names.get(head) || rest.length > 0);
      }
      return [...names].map(([name, isDir]) => ({ name, isDir })).sort((a, b) => (a.name < b.name ? -1 : 1));
    },
    readText: (rel) => (rel in files ? files[rel] : null),
  };
}

const entry = (body) => `import type { DomainEntries } from "@/lib/domain/types";\nexport const domainEntries = {\n${body}\n} satisfies DomainEntries;\n`;
const BASE = {
  "src/features/README.md": "",
  "src/features/_template/entities/drizzle.ts": `export const t = pgTable("template_rows", {});`,
  "src/features/sample/entities/drizzle.ts": `// pgTable("not_this", {})\nexport const s = pgTable("samples", {});`,
  "src/features/sample/services/server/domainEntry.ts": entry(`  sample: { service: () => import("./s"), table: "samples", idColumn: "id" },`),
  "src/features/sample/extensionPoints.ts": `export const extensionPoints = { adminBulkActions: { dir: "adminBulkActions", export: "item", type: { from: "@/x", name: "X" }, side: "client" } };`,
  "src/features/core/README.md": "",
  "src/features/core/wallet/entities/drizzle.ts": `export const w = pgTable("wallets", {});\nexport const l = pgTable("wallet_lots", {});`,
  "src/features/core/wallet/entities/drizzle.test.ts": `pgTable("test_only", {})`,
  "src/features/core/wallet/services/server/domainEntry.ts": entry(`  wallet: { service: () => import("./w"), table: "wallets", idColumn: "id" },`),
  "src/features/core/wallet/config.ts": `export const WALLET_CONFIG = {};`,
  "src/features/core/purchaseRequest/services/server/domainEntry.ts": entry(`  purchaseRequest: { service: () => import("./p"), table: null, idColumn: null, requires: ["wallet", "walletHistory"] },\n  purchaseRequestLog: { service: () => import("./q"), table: null, idColumn: null, requires: ["wallet"] },`),
  "src/featureGate/rules/wallet.ts": `export const rule: FeatureGateRule = { pathPatterns: ["/wallet"], features: ["core/wallet"], enabled: () => true };`,
  "src/featureGate/rules/signup.ts": `export const rule: FeatureGateRule = { pathPatterns: ["/signup"], enabled: () => true };`,
  "src/featureGate/rules/README.md": "",
  "src/lib/crud/index.ts": "",
  "src/lib/crud/extensions/x.ts": `export const extensionPoints = { ignored: {} };`,
  "src/lib/cron/index.ts": "",
  "src/config/lib/cron.config.ts": "export const c = {};",
  "src/proxies/index.ts": "",
  "src/proxies/extensionPoints.ts": `export const extensionPoints = { handlers: { dir: ".", export: "handler", type: { from: "@/x", name: "H" }, side: "server" } };`,
  "src/app/(user)/_layout/config.ts": `export const userLayoutConfig = { frame: "user", other: 1 } as const;`,
  "src/app/(user)/(protected)/mypage/_layout/Menu.tsx": "",
  "src/app/admin/_layout/config.ts": `export const adminLayoutConfig = { frame: "admin" };`,
};

test("4 種を見つけ、種類 → 名前で並べる。_ 始まり・core の置き場・宣言の無い _layout は地区にならない", () => {
  const { districts, problems } = readDistrictMap(memorySource(BASE));
  assert.deepEqual(problems, []);
  assert.deepEqual(
    districts.map((d) => `${d.kind}:${d.name}`),
    ["features:purchaseRequest", "features:sample", "features:wallet", "lib:cron", "lib:crud", "frame:admin", "frame:user", "proxies:proxies"],
  );
  const by = Object.fromEntries(districts.map((d) => [`${d.kind}:${d.name}`, d]));
  assert.equal(by["features:wallet"].core, true);
  assert.equal(by["features:sample"].core, false);
  assert.equal(by["lib:cron"].core, null);
  assert.equal(by["frame:user"].dir, "src/app/(user)/_layout");
  assert.equal(by["frame:user"].frame, "user");
  assert.equal(by["proxies:proxies"].dir, "src/proxies");
});

test("欄: config・上書きのパスと有無、apiKeys・requires・tables・gates・receptacles", () => {
  const by = Object.fromEntries(readDistrictMap(memorySource(BASE)).districts.map((d) => [`${d.kind}:${d.name}`, d]));
  const wallet = by["features:wallet"];
  assert.deepEqual(wallet.config, { path: "src/features/core/wallet/config.ts", exists: true });
  assert.deepEqual(wallet.override, { path: "src/config/features/wallet.config.ts", exists: false });
  assert.deepEqual(wallet.tables, ["wallets", "wallet_lots"]);
  assert.deepEqual(wallet.gates, ["wallet"]);
  assert.deepEqual(by["features:purchaseRequest"].apiKeys, ["purchaseRequest", "purchaseRequestLog"]);
  assert.deepEqual(by["features:purchaseRequest"].requires, ["wallet", "walletHistory"]);
  assert.deepEqual(by["features:sample"].tables, ["samples"]);
  assert.deepEqual(by["features:sample"].receptacles, ["adminBulkActions"]);
  assert.deepEqual(by["lib:cron"].override, { path: "src/config/lib/cron.config.ts", exists: true });
  assert.deepEqual(by["lib:crud"].receptacles, []);
  assert.deepEqual(by["frame:admin"].override, { path: "src/config/layout/admin.config.ts", exists: false });
  assert.deepEqual(by["proxies:proxies"].config, { path: "src/proxies/config.ts", exists: false });
  assert.deepEqual(by["proxies:proxies"].override, { path: "src/config/proxies/proxies.config.ts", exists: false });
  assert.deepEqual(by["proxies:proxies"].receptacles, ["handlers"]);
});

test("名前の一意: core と業務の同名は業務の側を直す文、枠の frame: の重複は両方のパス", () => {
  const files = { ...BASE, "src/features/wallet/index.ts": "", "src/app/(marketing)/_layout/config.ts": `export const c = { frame: "user" };` };
  const { problems } = readDistrictMap(memorySource(files));
  assert.equal(problems.length, 2, problems.join("\n"));
  assert.match(problems[0], /features の地区の名前 wallet が重なる: core の src\/features\/core\/wallet と業務の src\/features\/wallet.*業務のドメイン/);
  assert.match(problems[1], /枠の名前 user が重なる: .*\(marketing\)\/_layout\/config\.ts.*\(user\)\/_layout\/config\.ts/);
});

test("問題: frame: の無い枠の config・規則の features の行き先なし・domainEntry のキーの重なり・読めない表名", () => {
  const files = {
    ...BASE,
    "src/app/(marketing)/_layout/config.ts": `export const c = { title: "x" };`,
    "src/featureGate/rules/ghost.ts": `export const rule = { pathPatterns: [], features: ["core/ghost"], enabled: () => true };`,
    "src/features/sample/services/server/domainEntry.ts": entry(`  wallet: { service: () => import("./s"), table: "samples", idColumn: "id" },`),
    "src/features/sample/entities/more.ts": `const n = "x"; export const t = pgTable(n, {});`,
  };
  const { problems } = readDistrictMap(memorySource(files));
  assert.ok(problems.some((p) => /\(marketing\)\/_layout\/config\.ts: 枠の config\.ts に frame: "<枠の名前>" が無い/.test(p)), problems.join("\n"));
  assert.ok(problems.some((p) => /ghost\.ts: features の core\/ghost に当たる features の地区が無い/.test(p)));
  assert.ok(problems.some((p) => /domainEntry のキー wallet が src\/features\/core\/wallet・src\/features\/sample で重なる/.test(p)));
  assert.ok(problems.some((p) => /more\.ts: pgTable の表名が文字列リテラルでない/.test(p)));
});

test("字面の読み手: requires の式・features の式・frame の式は問題、無い物は空", () => {
  assert.deepEqual(readDomainEntry("e.ts", entry(`  a: { requires: list },`)).problems.length, 1);
  assert.deepEqual(readDomainEntry("e.ts", "export const other = {};").keys, []);
  assert.deepEqual(readRuleFeatures("r.ts", "export const rule = { features: names };").problems.length, 1);
  assert.deepEqual(readRuleFeatures("r.ts", "export const rule = { pathPatterns: [] };"), { features: [], problems: [] });
  assert.deepEqual(readFrameName("c.ts", "export const c = { frame: NAME };").frame, null);
  assert.deepEqual(readFrameName("c.ts", "export const c = {};"), { frame: null, problems: [] });
  assert.deepEqual(readTableNames("t.ts", `/* pgTable("x") */ pgTable('y', {})`).tables, ["y"]);
});

test("toJsonl: 1 行 1 地区で末尾に改行、空なら空", () => {
  const { districts } = readDistrictMap(memorySource(BASE));
  const text = toJsonl(districts);
  assert.equal(text.split("\n").length, districts.length + 1);
  assert.deepEqual(JSON.parse(text.split("\n")[0]), districts[0]);
  assert.deepEqual(Object.keys(districts[0]), ["kind", "name", "core", "dir", "domainJson", "generate", "config", "override", "apiKeys", "tables", "requires", "gates", "receptacles", "frame"]);
  assert.equal(toJsonl([]), "");
});

test("tableFiles: features の地区の表と定義ファイル(パス順 → 出現順、雛形とテストは除く)、tableProblems は表の問題だけ", () => {
  const { tableFiles, tableProblems } = readDistrictMap(memorySource(BASE));
  assert.deepEqual(tableFiles, [
    { name: "samples", file: "src/features/sample/entities/drizzle.ts", dir: "src/features/sample" },
    { name: "wallets", file: "src/features/core/wallet/entities/drizzle.ts", dir: "src/features/core/wallet" },
    { name: "wallet_lots", file: "src/features/core/wallet/entities/drizzle.ts", dir: "src/features/core/wallet" },
  ].sort((a, b) => (a.file < b.file ? -1 : a.file > b.file ? 1 : 0)));
  assert.deepEqual(tableProblems, []);
  const broken = readDistrictMap(memorySource({ ...BASE, "src/features/sample/entities/more.ts": `const n = "x"; pgTable(n, {});`, "src/featureGate/rules/ghost.ts": `export const rule = { features: ["core/ghost"] };` }));
  assert.deepEqual(broken.tableProblems, ["src/features/sample/entities/more.ts: pgTable の表名が文字列リテラルでない(字面で読めない)"]);
  assert.ok(broken.problems.length > broken.tableProblems.length);
});

test("domainJson・generate: features は domain.json の有無と generate(省略 = true、無し = null)、ほかの種類は null、壊れた JSON は問題", () => {
  const files = { ...BASE, "src/features/sample/domain.json": '{ "name": "sample" }', "src/features/core/wallet/domain.json": '{ "generate": false }' };
  const by = Object.fromEntries(readDistrictMap(memorySource(files)).districts.map((d) => [`${d.kind}:${d.name}`, d]));
  assert.deepEqual([by["features:sample"].domainJson, by["features:sample"].generate], [true, true]);
  assert.deepEqual([by["features:wallet"].domainJson, by["features:wallet"].generate], [true, false]);
  assert.deepEqual([by["features:purchaseRequest"].domainJson, by["features:purchaseRequest"].generate], [false, null]);
  assert.deepEqual([by["lib:cron"].domainJson, by["lib:cron"].generate], [null, null]);
  const broken = readDistrictMap(memorySource({ ...BASE, "src/features/sample/domain.json": "{ nope" }));
  assert.ok(broken.problems.some((p) => /src\/features\/sample\/domain\.json: JSON として読めない/.test(p)), broken.problems.join("\n"));
});
