// src/lib/districtMap/districtMap.test.mjs — 地区の地図の読み手を、注入した小さな木で確かめる(node:fs を使わない)
// 実行: pnpm test src/lib/districtMap(今の木との照合は scripts/structure/district-map/districtMap.test.mjs)
import assert from "node:assert/strict";
import { test } from "node:test";

import { CONTENTS_OVERRIDE_FOLDERS, DISTRICT_KINDS, KINDS, OVERRIDE_FOLDERS, kindOf, overridePathOf, readOverrideLoaders } from "./index.mjs";
import { pointsFromFiles, readDeclaration, readDistrictMap, readDomainEntry, readFeatureRequirements, readFrameName, readOverrideImports, readRuleDomains, readTableNames, toJsonl } from "./index.mjs";

/**
 * パス → 本文 の表から source を作る(フォルダはパスから導く)
 * @param {Record<string, string>} files
 * @returns {import("./read.mjs").DistrictSource}
 */
function memorySource(files) {
  const paths = Object.keys(files);
  return {
    listDir(rel) {
      const prefix = `${rel}/`;
      /** @type {Map<string, boolean>} */
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

const entry = (/** @type {string} */ body) => `import type { DomainEntries } from "@/lib/domain";\nexport const domainEntries = {\n${body}\n} satisfies DomainEntries;\n`;
const BASE = {
  "src/domains/README.md": "",
  "src/domains/_template/entities/drizzle.ts": `export const t = pgTable("template_rows", {});`,
  "src/domains/sample/entities/drizzle.ts": `// pgTable("not_this", {})\nexport const s = pgTable("samples", {});`,
  "src/domains/sample/services/server/domainEntry.ts": entry(`  sample: { service: () => import("./s"), table: "samples", idColumn: "id" },`),
  "src/domains/sample/extensionPoints.ts": `export const extensionPoints = { adminBulkActions: { change: "add", dir: "adminBulkActions", export: "item", type: { from: "@/x", name: "X" }, side: "client" } };\nexport const alwaysOpen = true;`,
  "src/domains/core/README.md": "",
  "src/domains/core/wallet/entities/drizzle.ts": `export const w = pgTable("wallets", {});\nexport const l = pgTable("wallet_lots", {});`,
  "src/domains/core/wallet/entities/drizzle.test.ts": `pgTable("test_only", {})`,
  "src/domains/core/wallet/services/server/domainEntry.ts": entry(`  wallet: { service: () => import("./w"), table: "wallets", idColumn: "id" },`),
  "src/domains/core/wallet/config.ts": `export const WALLET_CONFIG = {};`,
  "src/domains/core/purchaseRequest/services/server/domainEntry.ts": entry(`  purchaseRequest: { service: () => import("./p"), table: null, idColumn: null, requires: ["wallet", "walletHistory"] },\n  purchaseRequestLog: { service: () => import("./q"), table: null, idColumn: null, requires: ["wallet"] },`),
  "src/domains/core/purchaseRequest/extensionPoints.ts": "export const alwaysOpen = true;",
  "src/featureGate/rules/wallet.ts": `export const rule: FeatureGateRule = { pathPatterns: ["/wallet"], domains: ["core/wallet"], enabled: () => true };`,
  "src/featureGate/rules/signup.ts": `export const rule: FeatureGateRule = { pathPatterns: ["/signup"], enabled: () => true };`,
  "src/featureGate/rules/README.md": "",
  "src/lib/crud/index.ts": "",
  "src/lib/crud/extensions/x.ts": `export const extensionPoints = { ignored: {} };`,
  "src/lib/cron/index.ts": "",
  "src/config/lib/cron.config.ts": "export const c = {};",
  "src/proxies/index.ts": "",
  "src/proxies/extensionPoints.ts": `export const extensionPoints = { proxyHandlers: { change: "add", plugs: true, export: "handler", type: { from: "@/x", name: "H" }, side: "server" } };`,
  "src/app/(user)/_layout/config.ts": `export const userLayoutConfig = { frame: "user", other: 1 } as const;`,
  "src/app/(user)/(protected)/mypage/_layout/Menu.tsx": "",
  "src/app/admin/_layout/config.ts": `export const adminLayoutConfig = { frame: "admin" };`,
};

test("種類の表の 7 種類を見つけ、種類 → 名前で並べる。_ 始まり・core の置き場・宣言の無い _layout は地区にならない", () => {
  const { districts, problems } = readDistrictMap(memorySource(BASE));
  assert.deepEqual(problems, []);
  assert.deepEqual(
    districts.map((d) => `${d.kind}:${d.name}`),
    ["domains:purchaseRequest", "domains:sample", "domains:wallet", "lib:cron", "lib:crud", "frame:admin", "frame:user", "featureGate:featureGate", "proxies:proxies"],
  );
  const by = Object.fromEntries(districts.map((d) => [`${d.kind}:${d.name}`, d]));
  assert.equal(by["domains:wallet"].core, true);
  assert.equal(by["domains:sample"].core, false);
  assert.equal(by["lib:cron"].core, null);
  assert.equal(by["frame:user"].dir, "src/app/(user)/_layout");
  assert.equal(by["frame:user"].frame, "user");
  assert.equal(by["proxies:proxies"].dir, "src/proxies", "proxies はテーマを持たず src 直下の 1 地区(D30)");
});

test("欄: config・上書きのパスと有無、apiKeys・requires・tables・gates・receptacles", () => {
  const by = Object.fromEntries(readDistrictMap(memorySource(BASE)).districts.map((d) => [`${d.kind}:${d.name}`, d]));
  const wallet = by["domains:wallet"];
  assert.deepEqual(wallet.config, { path: "src/domains/core/wallet/config.ts", exists: true });
  assert.deepEqual(wallet.override, { path: "src/config/domains/wallet.config.ts", exists: false });
  assert.deepEqual(wallet.tables, ["wallets", "wallet_lots"]);
  assert.deepEqual(wallet.gates, ["wallet"]);
  assert.deepEqual(by["domains:purchaseRequest"].apiKeys, ["purchaseRequest", "purchaseRequestLog"]);
  assert.deepEqual(by["domains:purchaseRequest"].requires, ["wallet", "walletHistory"]);
  assert.deepEqual(by["domains:sample"].tables, ["samples"]);
  assert.deepEqual(by["domains:sample"].receptacles, ["adminBulkActions"]);
  assert.equal(by["domains:sample"].alwaysOpen, true);
  assert.equal(by["domains:wallet"].alwaysOpen, false);
  assert.deepEqual(by["lib:cron"].override, { path: "src/config/lib/cron.config.ts", exists: true });
  assert.deepEqual(by["lib:crud"].receptacles, []);
  assert.deepEqual(by["frame:admin"].override, { path: "src/config/layout/admin.config.ts", exists: false });
  assert.equal(by["proxies:proxies"].override.path, null, "proxies は上書きの置き場を持たない(テーマを畳んだ、D30)");
});

test("欄: 描画専用の config.ui.ts と <名前>.ui.config.ts のパスと有無(L1.18)", () => {
  const files = {
    ...BASE,
    "src/domains/core/wallet/config.ui.ts": "export const WALLET_UI = {};",
    "src/config/domains/wallet.ui.config.ts": "export default {};",
    "src/config/layout/admin.ui.config.ts": "export default {};",
  };
  const by = Object.fromEntries(readDistrictMap(memorySource(files)).districts.map((d) => [`${d.kind}:${d.name}`, d]));
  assert.deepEqual(by["domains:wallet"].uiConfig, { path: "src/domains/core/wallet/config.ui.ts", exists: true });
  assert.deepEqual(by["domains:wallet"].uiOverride, { path: "src/config/domains/wallet.ui.config.ts", exists: true });
  assert.deepEqual(by["frame:admin"].uiConfig, { path: "src/app/admin/_layout/config.ui.ts", exists: false });
  assert.deepEqual(by["frame:admin"].uiOverride, { path: "src/config/layout/admin.ui.config.ts", exists: true });
  assert.deepEqual(by["lib:cron"].uiOverride, { path: "src/config/lib/cron.ui.config.ts", exists: false });
});

test("lib の見つけ方は libPackage の listLibsFrom と同じ(src/lib 直下のフォルダ、ファイルは数えない)", async () => {
  const { listLibsFrom } = await import("../libPackage/index.mjs");
  const source = memorySource({ ...BASE, "src/lib/README.md": "", "src/lib/CATALOG.md": "" });
  const libs = readDistrictMap(source).districts.filter((d) => d.kind === "lib").map((d) => d.name);
  assert.deepEqual(libs, listLibsFrom(source.listDir));
  assert.deepEqual(libs, ["cron", "crud"]);
});

test("名前の一意: core と業務の同名は業務の側を直す文、枠の frame: の重複は両方のパス", () => {
  const files = { ...BASE, "src/domains/wallet/index.ts": "", "src/domains/wallet/extensionPoints.ts": "export const alwaysOpen = true;", "src/app/(marketing)/_layout/config.ts": `export const c = { frame: "user" };` };
  const { problems } = readDistrictMap(memorySource(files));
  assert.equal(problems.length, 2, problems.join("\n"));
  assert.match(problems[0], /domains の地区の名前 wallet が重なる: core の src\/domains\/core\/wallet と業務の src\/domains\/wallet.*業務のドメイン/);
  assert.match(problems[1], /枠の名前 user が重なる: .*\(marketing\)\/_layout\/config\.ts.*\(user\)\/_layout\/config\.ts/);
});

test("問題: frame: の無い枠の config・規則の features の行き先なし・domainEntry のキーの重なり・読めない表名", () => {
  const files = {
    ...BASE,
    "src/app/(marketing)/_layout/config.ts": `export const c = { title: "x" };`,
    "src/featureGate/rules/ghost.ts": `export const rule = { pathPatterns: [], domains: ["core/ghost"], enabled: () => true };`,
    "src/domains/sample/services/server/domainEntry.ts": entry(`  wallet: { service: () => import("./s"), table: "samples", idColumn: "id" },`),
    "src/domains/sample/entities/more.ts": `const n = "x"; export const t = pgTable(n, {});`,
  };
  const { problems } = readDistrictMap(memorySource(files));
  assert.ok(problems.some((p) => /\(marketing\)\/_layout\/config\.ts: 枠の config\.ts に frame: "<枠の名前>" が無い/.test(p)), problems.join("\n"));
  assert.ok(problems.some((p) => /ghost\.ts: domains の core\/ghost に当たる domains の地区が無い/.test(p)));
  assert.ok(problems.some((p) => /domainEntry のキー wallet が src\/domains\/core\/wallet・src\/domains\/sample で重なる/.test(p)));
  assert.ok(problems.some((p) => /more\.ts: pgTable の表名が文字列リテラルでない/.test(p)));
});

test("字面の読み手: requires の式・features の式・frame の式は問題、無い物は空", () => {
  assert.deepEqual(readDomainEntry("e.ts", entry(`  a: { requires: list },`)).problems.length, 1);
  assert.deepEqual(readDomainEntry("e.ts", "export const other = {};").keys, []);
  assert.deepEqual(readRuleDomains("r.ts", "export const rule = { domains: names };").problems.length, 1);
  assert.deepEqual(readRuleDomains("r.ts", "export const rule = { pathPatterns: [] };"), { domains: [], problems: [] });
  assert.deepEqual(readFrameName("c.ts", "export const c = { frame: NAME };").frame, null);
  assert.deepEqual(readFrameName("c.ts", "export const c = {};"), { frame: null, problems: [] });
  assert.deepEqual(readTableNames("t.ts", `/* pgTable("x") */ pgTable('y', {})`).tables, ["y"]);
});

test("readOverrideImports: export const overrideImports の文字列の配列を字面で読む(L1.19)", () => {
  assert.deepEqual(readOverrideImports("c.ts", `export const overrideImports = ["next/font/google", "@/components/Icons"] as const;`), { imports: ["next/font/google", "@/components/Icons"], problems: [] });
  assert.deepEqual(readOverrideImports("c.ts", "export const walletConfig = {};"), { imports: [], problems: [] });
  assert.equal(readOverrideImports("c.ts", "export const overrideImports = LIST;").problems.length, 1);
  assert.equal(readOverrideImports("c.ts", `export const overrideImports = ["a", b] as const;`).problems.length, 1);
});

test("toJsonl: 1 行 1 地区で末尾に改行、空なら空", () => {
  const { districts } = readDistrictMap(memorySource(BASE));
  const text = toJsonl(districts);
  assert.equal(text.split("\n").length, districts.length + 1);
  assert.deepEqual(JSON.parse(text.split("\n")[0]), districts[0]);
  assert.deepEqual(Object.keys(districts[0]), ["kind", "name", "core", "dir", "domainJson", "generate", "config", "override", "uiConfig", "uiOverride", "apiKeys", "tables", "requires", "gates", "alwaysOpen", "receptacles", "frame", "featureRequirements", "forkCan"]);
  assert.equal(toJsonl([]), "");
});

test("tableFiles: domains の地区の表と定義ファイル(パス順 → 出現順、雛形とテストは除く)、tableProblems は表の問題だけ", () => {
  const { tableFiles, tableProblems } = readDistrictMap(memorySource(BASE));
  assert.deepEqual(tableFiles, [
    { name: "samples", file: "src/domains/sample/entities/drizzle.ts", dir: "src/domains/sample" },
    { name: "wallets", file: "src/domains/core/wallet/entities/drizzle.ts", dir: "src/domains/core/wallet" },
    { name: "wallet_lots", file: "src/domains/core/wallet/entities/drizzle.ts", dir: "src/domains/core/wallet" },
  ].sort((a, b) => (a.file < b.file ? -1 : a.file > b.file ? 1 : 0)));
  assert.deepEqual(tableProblems, []);
  const broken = readDistrictMap(memorySource({ ...BASE, "src/domains/sample/entities/more.ts": `const n = "x"; pgTable(n, {});`, "src/featureGate/rules/ghost.ts": `export const rule = { domains: ["core/ghost"] };` }));
  assert.deepEqual(broken.tableProblems, ["src/domains/sample/entities/more.ts: pgTable の表名が文字列リテラルでない(字面で読めない)"]);
  assert.ok(broken.problems.length > broken.tableProblems.length);
});

test("domainJson・generate: domains は domain.json の有無と登録の entity.json の generate(省略 = true、無し = null)、ほかの種類は null、壊れた JSON は問題", () => {
  const DOMAIN_JSON = '{ "domainConfigVersion": "2.0" }';
  const files = {
    ...BASE,
    "src/domains/sample/domain.json": DOMAIN_JSON,
    "src/domains/sample/entities/sample/entity.json": '{ "singular": "sample" }',
    "src/domains/core/wallet/domain.json": DOMAIN_JSON,
    "src/domains/core/wallet/entities/wallet/entity.json": '{ "generate": false }',
  };
  const by = Object.fromEntries(readDistrictMap(memorySource(files)).districts.map((d) => [`${d.kind}:${d.name}`, d]));
  assert.deepEqual([by["domains:sample"].domainJson, by["domains:sample"].generate], [true, true]);
  assert.deepEqual([by["domains:wallet"].domainJson, by["domains:wallet"].generate], [true, false]);
  assert.deepEqual([by["domains:purchaseRequest"].domainJson, by["domains:purchaseRequest"].generate], [false, null]);
  assert.deepEqual([by["lib:cron"].domainJson, by["lib:cron"].generate], [null, null]);
  const broken = readDistrictMap(memorySource({ ...BASE, "src/domains/sample/domain.json": DOMAIN_JSON, "src/domains/sample/entities/sample/entity.json": "{ nope" }));
  assert.ok(broken.problems.some((p) => /src\/domains\/sample\/entities\/sample\/entity\.json: JSON として読めない/.test(p)), broken.problems.join("\n"));
});

test("readFeatureRequirements: export const featureRequirements のリテラルを読む・誤りは問題に(設定 D110)", () => {
  const ok = readFeatureRequirements(
    "c.ts",
    `export const featureRequirements = [{ key: "purchaseRestriction", feature: "phoneVerification", off: "none" }, { key: "a.b", feature: "x", off: false, element: true }] as const satisfies readonly FeatureRequirement[];`,
  );
  assert.deepEqual(ok, {
    requirements: [
      { key: "purchaseRestriction", feature: "phoneVerification", off: "none" },
      { key: "a.b", feature: "x", off: false, element: true },
    ],
    problems: [],
  });
  assert.deepEqual(readFeatureRequirements("c.ts", "export const other = 1;"), { requirements: [], problems: [] });
  assert.equal(readFeatureRequirements("c.ts", "export const featureRequirements = LIST;").problems.length, 1);
  assert.equal(readFeatureRequirements("c.ts", `export const featureRequirements = [{ key: "a", feature: "x" }];`).problems.length, 1, "off が無い");
  assert.equal(readFeatureRequirements("c.ts", `export const featureRequirements = [{ key: "a", feature: "x", off: 0, extra: 1 }];`).problems.length, 1, "未知のキー");
  assert.equal(readFeatureRequirements("c.ts", `export const featureRequirements = [{ key: "a b", feature: "x", off: 0 }];`).problems.length, 1, "鍵の形");
});

test("readOverrideLoaders: export const overrideLoaders の文字列の配列を字面で読む", () => {
  assert.deepEqual(readOverrideLoaders("c.ts", `export const overrideLoaders = ["next/font/google", "next/font/local"] as const;`), { loaders: ["next/font/google", "next/font/local"], problems: [] });
  assert.deepEqual(readOverrideLoaders("c.ts", "export const fontsConfig = {};"), { loaders: [], problems: [] });
  assert.equal(readOverrideLoaders("c.ts", "export const overrideLoaders = LIST;").problems.length, 1);
});

test("種類の表: 7 種類と属性。ゲートはドメインだけ、src 直下の 4 種は Tier1 だけが足す、上書きの置き場は表から導く", () => {
  assert.deepEqual(DISTRICT_KINDS, KINDS.map((k) => k.kind));
  assert.deepEqual(DISTRICT_KINDS, ["domains", "lib", "frame", "featureGate", "registry", "wiring", "proxies"]);
  assert.deepEqual(KINDS.filter((k) => k.hasGate).map((k) => k.kind), ["domains"]);
  assert.deepEqual(KINDS.filter((k) => k.addedBy === "tier1").map((k) => k.kind), ["featureGate", "registry", "wiring", "proxies"]);
  assert.deepEqual(KINDS.filter((k) => k.readsSet).map((k) => k.kind), ["featureGate", "registry", "wiring"]);
  for (const k of KINDS) assert.ok(k.forkMay.every((t) => ["replace", "override", "add", "counterpart"].includes(t)), k.kind);
  assert.deepEqual(OVERRIDE_FOLDERS, { domains: "domains", lib: "lib", frame: "layout" });
  assert.deepEqual(CONTENTS_OVERRIDE_FOLDERS, { featureGate: "src/featureGate" });
  assert.equal(overridePathOf("registry", "registry"), null);
  assert.equal(kindOf("wiring")?.dir, "src/wiring");
});

test("src 直下の 1 地区の種類: フォルダがあれば 1 地区(名前 = フォルダ名)、上書きの無い種類は override の path が null", () => {
  const { districts, problems } = readDistrictMap(memorySource({ ...BASE, "src/registry/a.ts": "", "src/wiring/b.ts": "", "src/wiring/x/extensionPoints.ts": `export const extensionPoints = { inputs: { change: "add", dir: "inputs", export: "i", type: { from: "@/x", name: "I" }, side: "client" } };` }));
  assert.deepEqual(problems, []);
  const by = Object.fromEntries(districts.map((d) => [`${d.kind}:${d.name}`, d]));
  assert.deepEqual(districts.filter((d) => ["featureGate", "registry", "wiring"].includes(d.kind)).map((d) => `${d.kind}:${d.name}:${d.dir}`), [
    "featureGate:featureGate:src/featureGate",
    "registry:registry:src/registry",
    "wiring:wiring:src/wiring",
  ]);
  assert.deepEqual(by["registry:registry"].override, { path: null, exists: false });
  assert.deepEqual(by["featureGate:featureGate"].override, { path: null, exists: false }, "中身の名前で置く上書きは地区の名前の 1 本でない");
  assert.deepEqual(by["wiring:wiring"].receptacles, ["inputs"]);
});

test("forkCan: 種類の点(config.ts がある地区の config の対置点)→ 地区の宣言の点(writer は除く)、where は fork が書くファイルの glob", () => {
  const { districts } = readDistrictMap(memorySource({
    ...BASE,
    "src/domains/core/wallet/config.ui.ts": "export const ui = {};",
    "src/domains/core/wallet/extensionPoints.ts": `export const extensionPoints = {
  roles: { change: "add", writer: "role:generate", side: "shared" },
  hooks: { change: "add", dir: ".", files: "*/_hook.ts", export: "h", type: { from: "@/x", name: "H" }, side: "server" },
  targets: { change: "override", overrides: "src/domains/core/wallet/t/*.json", export: "override", side: "server", overrideOf: ["a"] },
  icon: { change: "counterpart", placement: "src/app/icon.png", kind: "edit" },
  sender: { change: "replace", default: "src/domains/core/wallet/sender.default.ts", type: { from: "@/x", name: "S" }, side: "server" },
};`,
  }));
  const wallet = districts.find((d) => d.name === "wallet");
  assert.deepEqual(wallet?.forkCan, [
    { point: "config", change: "counterpart", where: "src/config/domains/wallet.config.ts" },
    { point: "configUi", change: "counterpart", where: "src/config/domains/wallet.ui.config.ts" },
    { point: "hooks", change: "add", where: "src/domains/core/wallet/*/_hook.ts" },
    { point: "targets", change: "override", where: "src/domains/core/wallet/t/*.override.ts" },
    { point: "icon", change: "counterpart", where: "src/app/icon.png" },
    { point: "sender", change: "replace", where: "src/domains/core/wallet/sender.replace.ts" },
  ]);
  const sample = districts.find((d) => d.name === "sample");
  assert.deepEqual(sample?.forkCan, [{ point: "adminBulkActions", change: "add", where: "src/domains/sample/adminBulkActions/*" }], "config.ts の無い地区は種類の config の点を持たない");
  assert.deepEqual(districts.find((d) => d.kind === "featureGate")?.forkCan, [{ point: "config", change: "counterpart", where: "src/config/featureGate/*.config.ts" }]);
});

test("forkCan: plugs の点の where は自分のドメインか lib の plugs/<点>/(差す側 = domains と lib の地区)", () => {
  const { districts } = readDistrictMap(memorySource({
    ...BASE,
    "src/domains/core/wallet/extensionPoints.ts": `export const extensionPoints = {
  walletPlugs: { change: "add", plugs: true, export: "plug", type: { from: "@/x", name: "P" }, side: "server", shape: "object" },
};`,
  }));
  assert.deepEqual(districts.find((d) => d.name === "wallet")?.forkCan.find((f) => f.point === "walletPlugs"), { point: "walletPlugs", change: "add", where: "<自分のドメインか lib>/plugs/walletPlugs/*" });
});

test("forkCan: 枠の種類の点 layout(差替点)は _layout の隣の layout.tsx が ./_layout/ を指す 1 行スイッチの枠だけ。枠の宣言の差替点は src/app の下の既定も載る", () => {
  const { districts } = readDistrictMap(memorySource({
    ...BASE,
    "src/app/(user)/layout.tsx": '// 枠の 1 行スイッチ\nexport { UserLayout as default } from "./_layout/UserLayout";\n',
    "src/app/admin/layout.tsx": 'import { AdminLayout } from "./_layout/AdminLayout";\nexport default AdminLayout;\n',
    "src/app/(user)/_layout/extensionPoints.ts": `export const extensionPoints = {
  providers: { change: "replace", default: "src/app/_providers/P.default.tsx", type: { from: "@/x", name: "P" }, side: "shared" },
};`,
  }));
  const forkCanOf = (/** @type {string} */ name) => districts.find((d) => d.kind === "frame" && d.name === name)?.forkCan.filter((f) => f.change === "replace");
  assert.deepEqual(forkCanOf("user"), [
    { point: "layout", change: "replace", where: "src/app/(user)/layout.tsx" },
    { point: "providers", change: "replace", where: "src/app/_providers/P.replace.tsx" },
  ]);
  assert.deepEqual(forkCanOf("admin"), [], "1 行スイッチでない layout.tsx は種類の点に載せない");
});

test("常設の明示の宣言(D22・D53、注文 35): 規則に載るドメインの宣言と、規則にも載らず宣言も無いドメインは止める。宣言はドメインだけ・字面の true だけ", () => {
  const both = readDistrictMap(memorySource({ ...BASE, "src/domains/core/wallet/extensionPoints.ts": "export const alwaysOpen = true;" }));
  assert.deepEqual(both.problems.length, 1, both.problems.join("\n"));
  assert.match(both.problems[0], /src\/domains\/core\/wallet\/extensionPoints\.ts: wallet は常設の宣言\(alwaysOpen\)があるのに規則 wallet が domains に載せている/);
  const neither = readDistrictMap(memorySource({ ...BASE, "src/domains/core/purchaseRequest/extensionPoints.ts": "export const extensionPoints = {};" }));
  assert.deepEqual(neither.problems.length, 1, neither.problems.join("\n"));
  assert.match(neither.problems[0], /src\/domains\/core\/purchaseRequest: purchaseRequest はどの規則の domains にも載らず常設の宣言も無い/);
  assert.match(readDeclaration("src/domains/x/extensionPoints.ts", "export const alwaysOpen = 1;").problems[0], /alwaysOpen は字面の true だけ/);
  assert.deepEqual(readDeclaration("src/domains/x/extensionPoints.ts", "export const alwaysOpen = true;"), { points: {}, alwaysOpen: true, problems: [] });
  const lib = pointsFromFiles(["src/lib/x/extensionPoints.ts"], () => "export const alwaysOpen = true;");
  assert.match(lib.problems[0], /alwaysOpen\(常設\)を宣言できるのはドメインだけ/);
  assert.deepEqual(pointsFromFiles(["src/domains/core/auth/extensionPoints.ts"], () => "export const alwaysOpen = true;").alwaysOpen, ["src/domains/core/auth"]);
});
