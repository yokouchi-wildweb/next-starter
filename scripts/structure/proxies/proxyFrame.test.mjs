// scripts/structure/proxies/proxyFrame.test.mjs
// proxy の枠(点 proxyHandlers・proxyDecorators の項目 <ドメイン>/plugs/<点>/<名前>.ts の走査と生成一覧)と常時実行の入口の判定の回帰テスト。一時ディレクトリで動かす。
// 生成器は汎用の拡張点の生成器(scripts/structure/extensions/)で、宣言は実物の src/proxies/extensionPoints.ts をそのまま使う。
// - 項目 = 差す側の plugs/proxyHandlers・proxyDecorators の export const handler / decorator。handler は段 export const stage を選ぶ(D30)
// - 並びは段 → <差す側>/<名前> の順、上流と fork の項目はどちらも各自のドメインから同じ一覧に入る
// - 古い置き場(src/proxies/<名前>.ts の handler / decorator・src/proxies/redirects/)は止める(段 3 の道具が動かす)
// - 機能を閉じる規則(門番 src/featureGate/rules/、宣言は実物の src/featureGate/extensionPoints.ts): features のフォルダから tables を導き、名前を付ける(derive featureTables)、失敗の各条件
// 生成一覧の一致(実リポ)は pnpm test scripts/structure/extensions と pnpm check extensions
// 実行: pnpm test scripts/structure/proxies/proxyFrame.test.mjs

import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

import { createFeatureTables } from "../extensions/derive/featureTables.mjs";
import { readSectionFeature } from "../extensions/derive/gateSettingPaths.mjs";
import { scanFeatureTables } from "../registry/tableScan.mjs";
import { itemsOf, planExtensions } from "../extensions/extensions.mjs";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const DECLARATION = readFileSync(join(repoRoot, "src/proxies/extensionPoints.ts"), "utf8");
const GATE_DECLARATION = readFileSync(join(repoRoot, "src/featureGate/extensionPoints.ts"), "utf8");
const SKELETON_FILES = ["featureGate.ts", "redirect.ts"];
const HANDLERS = "src/proxies/extensions/proxyHandlers.ts";
const DECORATORS = "src/proxies/extensions/proxyDecorators.ts";
const GATE_RULES = "src/featureGate/extensions/rules.ts";

/** fork(acme、祖先 parent)、骨組み + 渡したファイルを置いた一時リポ */
function fixture(files) {
  const root = mkdtempSync(join(tmpdir(), "proxy-frame-"));
  mkdirSync(join(root, ".claude/rules"), { recursive: true });
  writeFileSync(join(root, "repo.json"), '{"repo_id": "acme", "tier": "leaf"}\n');
  mkdirSync(join(root, ".notices/applied"), { recursive: true });
  writeFileSync(join(root, ".notices/applied/parent.md"), "");
  const dir = join(root, "src/proxies");
  mkdirSync(join(dir, "extensions"), { recursive: true });
  const gateDir = join(root, "src/featureGate");
  mkdirSync(join(gateDir, "rules"), { recursive: true });
  writeFileSync(join(gateDir, "extensionPoints.ts"), GATE_DECLARATION);
  writeFileSync(join(dir, "extensionPoints.ts"), DECLARATION);
  for (const name of [...SKELETON_FILES, "index.ts", "types.ts"]) writeFileSync(join(dir, name), "export const somethingProxy = () => {};\n");
  writeFileSync(join(dir, "proxy.test.mts"), "export const handler = 1;\n");
  // 点 proxyUser はちょうど 1 つ要る(required)。上流と同じく auth の項目を置く
  mkdirSync(join(root, "src/domains/auth/plugs/proxyUser"), { recursive: true });
  writeFileSync(join(root, "src/domains/auth/plugs/proxyUser/session.ts"), "export const plug = { createUser: () => async () => null };\n");
  // ちょうど 1 つの点を埋めるのは常設のドメインか lib だけ(D53): 上流と同じく auth は常設の宣言を持つ
  writeFileSync(join(root, "src/domains/auth/extensionPoints.ts"), "export const alwaysOpen = true;\n");
  // "rules/<名前>.ts" は門番の受け口、"src/…" はリポ直下から、それ以外は src/proxies の直下
  for (const [name, text] of Object.entries(files)) {
    const path = name.startsWith("src/") ? join(root, name) : join(name.startsWith("rules/") ? gateDir : dir, name);
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, text);
  }
  return root;
}

const H = (stage) => `export const stage = "${stage}";\nexport const handler: ProxyHandler = async (request, ctx) => {};\n`;
const D = "export const decorator: ProxyResponseDecorator = (request, response, ctx) => {};\n";
const names = (plan, point) => itemsOf(plan, "src/proxies", point).map((i) => i.name);

test("走査: 各ドメインの plugs/proxyHandlers・proxyDecorators の項目を段 → <差す側>/<名前> の順に集め、骨組み・テストは項目にしない", () => {
  const plan = planExtensions(fixture({
    "src/domains/a/plugs/proxyHandlers/zeta.ts": H("main"),
    "src/domains/b/plugs/proxyHandlers/alpha.ts": H("main"),
    "src/domains/b/plugs/proxyHandlers/stop.ts": H("maintenance"),
    "src/domains/a/plugs/proxyDecorators/gamma.ts": D,
    "src/domains/b/plugs/proxyDecorators/beta.ts": D,
  }));
  assert.deepEqual(plan.problems, []);
  assert.deepEqual(names(plan, "proxyHandlers"), ["stop", "zeta", "alpha"]);
  assert.deepEqual(names(plan, "proxyDecorators"), ["gamma", "beta"]);
  assert.match(plan.outputs[HANDLERS], /import \{ handler as proxyHandlers_b_stop \} from "@\/domains\/b\/plugs\/proxyHandlers\/stop";/);
  assert.match(plan.outputs[HANDLERS], /\{ domain: "b", name: "stop", requires: \[\], stage: "maintenance", plug: proxyHandlers_b_stop \}/);
  assert.match(plan.outputs[DECORATORS], /\{ domain: "a", name: "gamma", requires: \[\], plug: proxyDecorators_a_gamma \}/);
});

test("失敗: 古い置き場(src/proxies/<名前>.ts の handler / decorator・src/proxies/redirects/)・段の無い handler・骨組みの段", () => {
  const plan = planExtensions(fixture({
    "old.ts": H("main"),
    "oldDecorator.ts": D,
    "helper.ts": "export function helper() {}\n",
    "redirects/campaign.ts": "export const redirects = [];\n",
    "src/domains/a/plugs/proxyHandlers/noStage.ts": "export const handler = async () => {};\n",
    "src/domains/a/plugs/proxyHandlers/gateItem.ts": H("gate"),
  }));
  const text = plan.problems.join("\n");
  assert.match(text, /src\/proxies\/old\.ts: proxy の handler の古い置き場。自分のドメインの plugs\/proxyHandlers/);
  assert.match(text, /src\/proxies\/oldDecorator\.ts: proxy の decorator の古い置き場/);
  assert.match(text, /src\/proxies\/redirects\/: 転送の規則の古い置き場/);
  assert.match(text, /noStage\.ts: export const stage = "<段>" が無い/);
  assert.match(text, /gateItem\.ts: 段 gate は点の持ち主の骨組みだけが使う/);
  assert.ok(!text.includes("helper.ts"), "handler / decorator を出さない直下のファイルは止めない");
  assert.equal(plan.problems.length, 5, text);
});

test("規則: src/featureGate/rules/ の export const rule をファイル名順に集め、旧い x.<fork の名前>.ts は止める", () => {
  const R = 'export const rule: FeatureGateRule = { pathPatterns: ["/x"], enabled: () => true };\n';
  const plan = planExtensions(
    fixture({ "rules/wallet.ts": R, "rules/acmeShop.ts": R, "rules/alpha.ts": R, "rules/helper.ts": "export const x = 1;\n", "rules/beta.other.ts": R }),
  );
  assert.deepEqual(itemsOf(plan, "src/featureGate", "rules").map((i) => i.name), ["acmeShop", "alpha", "wallet"]);
  assert.equal(plan.problems.length, 2, plan.problems.join("\n"));
  assert.ok(plan.problems.some((p) => p.includes("helper.ts") && p.includes("export const rule")));
  assert.ok(plan.problems.some((p) => p.includes("beta.other.ts") && p.includes("印なしの beta.ts に改名")));
  assert.match(plan.outputs[GATE_RULES], /import \{ rule as rules_alpha \} from "@\/featureGate\/rules\/alpha";/);
  assert.match(plan.outputs[GATE_RULES], /export type FeatureName = "acmeShop" \| "alpha" \| "wallet";/);
  assert.match(plan.outputs[GATE_RULES], /export const rules: GeneratedFeatureRule\[\] = \[\n  \{ \.\.\.rules_acmeShop, name: "acmeShop", tables: \[\], domainApiPaths: \[\], settingPaths: \[\], cronPaths: \[\], dependsOn: \[\], anyOf: \[\], when: \[\] \},\n  \{ \.\.\.rules_alpha, name: "alpha", tables: \[\], domainApiPaths: \[\], settingPaths: \[\], cronPaths: \[\], dependsOn: \[\], anyOf: \[\], when: \[\] \},\n  \{ \.\.\.rules_wallet, name: "wallet", tables: \[\], domainApiPaths: \[\], settingPaths: \[\], cronPaths: \[\], dependsOn: \[\], anyOf: \[\], when: \[\] \},\n\];/);
});

test("規則の domains: ドメインのフォルダの pgTable から表(0 でもよい)と汎用 API の住所(domainEntry のキー)を導き(fork が上流のフォルダに足した表も)、失敗の各条件で止まる", () => {
  const rule = (body) => `export const rule: FeatureGateRule = { pathPatterns: ["/x"], ${body} enabled: () => true };\n`;
  const root = fixture({
    "rules/wallet.ts": rule('domains: [\n    "core/wallet",\n    "core/walletHistory",\n  ],'),
    "rules/plain.ts": rule(""),
    "rules/handWritten.ts": rule('tables: ["wallets"],'),
    "rules/variable.ts": rule("domains: FOLDERS,"),
    "rules/notLiteral.ts": rule("domains: [FOLDER],"),
    "rules/missing.ts": rule('domains: ["core/nowhere"],'),
    "rules/tableless.ts": rule('domains: ["core/empty"],'),
    "rules/nested.ts": rule('domains: ["core/wallet/entities"],'),
    "rules/coreRoot.ts": rule('domains: ["core"],'),
    "rules/handApi.ts": rule('domainApiPaths: ["/api/x"],'),
    "rules/brokenEntry.ts": rule('domains: ["core/broken"],'),
    "rules/noEntry.ts": rule('domains: ["core/quota"],'),
  });
  const feat = (name, tables) => {
    const d = join(root, "src/domains", name, "entities");
    mkdirSync(d, { recursive: true });
    writeFileSync(join(d, "drizzle.ts"), tables.map((t, i) => `export const T${i} = pgTable("${t}", {});\n`).join(""));
  };
  feat("core/wallet", ["wallets", "wallet_lots"]);
  feat("core/walletHistory", ["wallet_histories"]);
  feat("core/empty", []);
  feat("core/broken", ["brokens"]);
  feat("core/quota", ["quotas"]);
  const entry = (name, text) => {
    const d = join(root, "src/domains", name, "services/server");
    mkdirSync(d, { recursive: true });
    writeFileSync(join(d, "domainEntry.ts"), text);
  };
  // キー 1 つ・複数・壊れた entry(export が無い)。core/quota は entry 無し(住所を足さない)。core/empty は表 0 の Firestore 版(table: null)
  entry("core/wallet", "export const domainEntries = {\n  wallet: { table: \"wallets\" },\n} satisfies DomainEntries;\n");
  entry("core/walletHistory", "export const domainEntries = {\n  walletHistory: { table: \"wallet_histories\" },\n  walletLot: { table: \"wallet_lots\" },\n} satisfies DomainEntries;\n");
  entry("core/broken", "export const somethingElse = {};\n");
  entry("core/empty", "export const domainEntries = {\n  empty: { table: null },\n} satisfies DomainEntries;\n");
  // fork が上流のフォルダに足した表
  writeFileSync(join(root, "src/domains/core/wallet/entities/forkExtra.ts"), 'export const X = pgTable("wallet_fork_extras", {});\n');

  const plan = planExtensions(root);
  assert.deepEqual(
    itemsOf(plan, "src/featureGate", "rules").map((r) => `${r.name}:${r.fields.tables.join("|")}`),
    ["noEntry:quotas", "plain:", "tableless:", "wallet:wallets|wallet_lots|wallet_fork_extras|wallet_histories"],
  );
  assert.deepEqual(
    itemsOf(plan, "src/featureGate", "rules").map((r) => `${r.name}:${r.fields.domainApiPaths.join("|")}`),
    ["noEntry:", "plain:", "tableless:/api/empty", "wallet:/api/wallet|/api/walletHistory|/api/walletLot"],
  );
  const reasons = Object.fromEntries(["handWritten", "variable", "notLiteral", "missing", "nested", "coreRoot", "handApi", "brokenEntry"].map((n) => [n, plan.problems.find((p) => p.includes(`/${n}.ts`)) ?? ""]));
  assert.match(reasons.handWritten, /tables を手書き/);
  assert.match(reasons.variable, /文字列リテラルの配列でない/);
  assert.match(reasons.notLiteral, /文字列リテラルでない/);
  assert.match(reasons.missing, /無いフォルダ/);
  assert.match(reasons.nested, /"core\/wallet\/entities" はドメインの位置でない/);
  assert.match(reasons.coreRoot, /"core" はドメインの位置でない/);
  assert.match(reasons.handApi, /domainApiPaths を手書き/);
  assert.match(reasons.brokenEntry, /domainEntries が読めない/);
  assert.equal(plan.problems.length, 8, plan.problems.join("\n"));
  assert.match(
    plan.outputs[GATE_RULES],
    /\{ \.\.\.rules_wallet, name: "wallet", tables: \["wallets", "wallet_lots", "wallet_fork_extras", "wallet_histories"\], domainApiPaths: \["\/api\/wallet", "\/api\/walletHistory", "\/api\/walletLot"\], settingPaths: \[\], cronPaths: \[\], dependsOn: \[\], anyOf: \[\], when: \[\] \},/,
  );
  assert.match(plan.outputs[GATE_RULES], /\{ \.\.\.rules_noEntry, name: "noEntry", tables: \["quotas"\], domainApiPaths: \[\], settingPaths: \[\], cronPaths: \[\], dependsOn: \[\], anyOf: \[\], when: \[\] \},/);
  assert.match(plan.outputs[GATE_RULES], /\{ \.\.\.rules_tableless, name: "tableless", tables: \[\], domainApiPaths: \["\/api\/empty"\], settingPaths: \[\], cronPaths: \[\], dependsOn: \[\], anyOf: \[\], when: \[\] \},/);
  // 汎用 API の住所と表はドメインに付く(D34 K4): 規則の pathPatterns に足さず、生成一覧の domains に載る(フォルダの順、持つ機能つき)
  assert.match(
    plan.outputs[GATE_RULES],
    /export const domains: GatedDomain\[\] = \[\n  \{ folder: "core\/empty", tables: \[\], apiPaths: \["\/api\/empty"\], features: \["tableless"\] \},\n  \{ folder: "core\/quota", tables: \["quotas"\], apiPaths: \[\], features: \["noEntry"\] \},\n  \{ folder: "core\/wallet", tables: \["wallets", "wallet_lots", "wallet_fork_extras"\], apiPaths: \["\/api\/wallet"\], features: \["wallet"\] \},\n  \{ folder: "core\/walletHistory", tables: \["wallet_histories"\], apiPaths: \["\/api\/walletHistory", "\/api\/walletLot"\], features: \["wallet"\] \},\n\];/,
  );
  assert.match(plan.outputs[GATE_RULES], /export const cronTasks: GatedCronTask\[\] = \[\];/);
  assert.doesNotMatch(plan.outputs[GATE_RULES], /pathPatterns: \[\.\.\.rules_/, "設定の節の無い fixture では規則の pathPatterns に何も足さない");
});

test("古いキー features:(D33 で domains: に改名)は受けず、規則の名前と直し方を出して止める(上流・fork の規則とも。コメントの中は数えない)", () => {
  const rule = (body) => `export const rule: FeatureGateRule = { pathPatterns: ["/x"], ${body} };\n`;
  const plan = planExtensions(fixture({ "rules/old.ts": rule('features: ["core/wallet"],'), "rules/commented.ts": `// 昔は features: ["x"] と書いた\n${rule("")}`, "rules/fine.ts": rule("") }));
  const problems = plan.problems.filter((p) => p.includes("rules/"));
  assert.equal(problems.length, 1, problems.join("\n"));
  assert.match(problems[0], /rules\/old\.ts: features: は domains: に改めた\(中身のドメインのフォルダの並びはそのまま。D33\)。キーの名前を domains に直して pnpm generate extensions/);
});

test("ドメインの表: 1 つのドメインを 2 つの規則が持てば features に両方(一覧の順)、どの規則にも載らないドメインは載らない", () => {
  const rule = (folders) => `export const rule: FeatureGateRule = { pathPatterns: ["/x"], domains: [${folders.map((f) => JSON.stringify(f)).join(", ")}], enabled: () => true };\n`;
  const root = fixture({ "rules/users.ts": rule(["core/userTag"]), "rules/demoUsers.ts": rule(["core/userTag"]), "rules/plain.ts": rule([]) });
  for (const name of ["core/userTag", "core/base"]) {
    const d = join(root, "src/domains", name, "entities");
    mkdirSync(d, { recursive: true });
    writeFileSync(join(d, "drizzle.ts"), `export const T = pgTable("${name.split("/")[1]}s", {});\n`);
  }
  const plan = planExtensions(root);
  assert.deepEqual(plan.problems, []);
  assert.match(plan.outputs[GATE_RULES], /export const domains: GatedDomain\[\] = \[\n  \{ folder: "core\/userTag", tables: \["userTags"\], apiPaths: \[\], features: \["demoUsers", "users"\] \},\n\];/);
});

test("このリポの全ドメイン(src/domains/core/<名前>・src/domains/<名前>、_ で始まる雛形を除く)を features に書ける。表を持つフォルダはどれもドメインの位置にある", () => {
  const featureTables = createFeatureTables(repoRoot);
  const domains = [
    ...readdirSync(join(repoRoot, "src/domains/core"), { withFileTypes: true }).filter((e) => e.isDirectory()).map((e) => `core/${e.name}`),
    ...readdirSync(join(repoRoot, "src/domains"), { withFileTypes: true }).filter((e) => e.isDirectory() && e.name !== "core" && !e.name.startsWith("_")).map((e) => e.name),
  ];
  assert.ok(domains.includes("core/chatRoom"), "表を持たない chatRoom も数える");
  const rule = (folder) => `export const rule: FeatureGateRule = { pathPatterns: ["/x"], domains: ["${folder}"], enabled: () => true };\n`;
  const stopped = domains.map((folder) => featureTables.apply(folder, rule(folder), "x")).filter((r) => r.problem).map((r) => r.problem);
  assert.deepEqual(stopped, []);
  assert.deepEqual(featureTables.apply("chatRoom", rule("core/chatRoom"), "x").fields.tables, []);
  // 雛形(_ で始まるフォルダ)は地区でないので domains に書けない(src/lib/districtMap、目録 D3)
  assert.match(featureTables.apply("_template", rule("_template"), "x").problem, /"_template" はドメインの位置でない/);
  // 今までの判定(表が 1 つ以上ある)で通っていた書き方は、表を持つフォルダかその上。どれもドメインのフォルダの中にある = ドメインの位置で書ける
  const outside = scanFeatureTables(repoRoot).tables.map((t) => t.file).filter((file) => !domains.some((d) => file.startsWith(`src/domains/${d}/`)));
  assert.deepEqual(outside, []);
});

test("cron の門(目録 D10): task.ts・task.override.ts の値の import(静的・動的・相対)が features のフォルダに当たる規則に cronPaths を足す。型だけ・lib だけは数えない、2 規則なら両方(論理積)、手書きの /api/cron/ は止める", () => {
  const root = mkdtempSync(join(tmpdir(), "cron-gate-"));
  const put = (path, text) => {
    mkdirSync(dirname(join(root, path)), { recursive: true });
    writeFileSync(join(root, path), text);
  };
  put("tsconfig.json", JSON.stringify({ compilerOptions: { baseUrl: ".", paths: { "@/*": ["./src/*"] } } }));
  for (const d of ["core/wallet", "core/coupon", "core/audit"]) put(`src/domains/${d}/services/server/s.ts`, "export const s = 1;\n");
  put("src/lib/cron/index.ts", "export const runBudgetedBatches = 1;\n");
  const task = (name, text, file = "task.ts") => put(`src/app/api/cron/${name}/${file}`, text);
  task("static", 'import { s } from "@/domains/core/wallet/services/server/s";\nexport const task = s;\n');
  task("dynamic", 'export const task = { run: async () => (await import("@/domains/core/coupon/services/server/s")).s };\n');
  task("relative", 'import { s } from "../../../../domains/core/wallet/services/server/s";\nexport const task = s;\n');
  task("typeOnly", 'import type { S } from "@/domains/core/wallet/services/server/s";\nimport { runBudgetedBatches } from "@/lib/cron";\nexport const task = runBudgetedBatches;\n');
  task("both", 'import { s } from "@/domains/core/wallet/services/server/s";\nimport { s as c } from "@/domains/core/coupon/services/server/s";\nexport const task = [s, c];\n');
  task("overridden", 'import { runBudgetedBatches } from "@/lib/cron";\nexport const task = runBudgetedBatches;\n');
  task("overridden", 'import { s } from "@/domains/core/coupon/services/server/s";\nexport const taskOverride = s;\n', "task.override.ts");
  task("ungated", 'import { s } from "@/domains/core/audit/services/server/s";\nexport const task = s;\n');
  const featureTables = createFeatureTables(root);
  const rule = (folders, extra = "") => `export const rule: FeatureGateRule = { pathPatterns: ["/x"${extra}], domains: [${folders.map((f) => JSON.stringify(f)).join(", ")}], enabled: () => true };\n`;
  assert.deepEqual(featureTables.apply("wallet", rule(["core/wallet"]), "wallet").fields.cronPaths, ["/api/cron/both", "/api/cron/relative", "/api/cron/static"]);
  assert.deepEqual(featureTables.apply("coupon", rule(["core/coupon"]), "coupon").fields.cronPaths, ["/api/cron/both", "/api/cron/dynamic", "/api/cron/overridden"]);
  assert.deepEqual(featureTables.apply("plain", rule([]), "plain").fields.cronPaths, []);
  // cron の task の表: 読むドメイン(渡したフォルダのうち当たる物)。読むドメインの全部が開のとき開く
  assert.deepEqual(featureTables.cronTasksFor(["core/coupon", "core/wallet"]), [
    { path: "/api/cron/both", folders: ["core/coupon", "core/wallet"] },
    { path: "/api/cron/dynamic", folders: ["core/coupon"] },
    { path: "/api/cron/overridden", folders: ["core/coupon"] },
    { path: "/api/cron/relative", folders: ["core/wallet"] },
    { path: "/api/cron/static", folders: ["core/wallet"] },
  ]);
  assert.match(featureTables.apply("hand", rule(["core/wallet"], ', "/api/cron/static"'), "hand").problem, /cron の住所 \/api\/cron\/… を手書き/);
});

test("設定の節の feature: 字面で読む(1 つ・配列・複数行)、書けない形は problem", () => {
  assert.deepEqual(readSectionFeature('export const section = { key: "general", label: "x", order: 1 };'), { key: "general", features: [] });
  assert.deepEqual(readSectionFeature('export const section = { key: "shop", feature: "wallet", order: 1 };'), { key: "shop", features: ["wallet"] });
  assert.deepEqual(readSectionFeature('export const section = {\n  key: "shop",\n  feature: [\n    "wallet",\n    "payment",\n  ],\n};'), { key: "shop", features: ["wallet", "payment"] });
  assert.deepEqual(readSectionFeature('// feature: "nope"\nexport const section = { key: "a", features: ["x"] };'), { key: "a", features: [] });
  assert.match(readSectionFeature('export const section = { key: "a", feature: NAME };').problem, /文字列リテラル/);
  assert.match(readSectionFeature('export const section = { key: "a", feature: ["wallet", NAME] };').problem, /NAME/);
  assert.match(readSectionFeature('export const section = { key: KEY, feature: "wallet" };').problem, /key/);
});

test("設定の節の feature から /admin/settings/<key> を導き、生成一覧の settingSections(住所・名指す機能)に載せる(規則の pathPatterns には足さず settingPaths は説明用)。規則名でない feature は止める", () => {
  const R = 'export const rule: FeatureGateRule = { pathPatterns: ["/x"], enabled: () => true };\n';
  const root = fixture({ "rules/wallet.ts": R, "rules/payment.ts": R, "rules/plain.ts": R });
  const dir = join(root, "src/domains/core/setting/plugs/settingSections");
  mkdirSync(join(dir, "nested"), { recursive: true });
  writeFileSync(join(dir, "general.ts"), 'export const section = { key: "general", label: "基本", order: 10 };\n');
  writeFileSync(join(dir, "shop.ts"), 'export const section = { key: "shop", label: "店", order: 20, feature: ["wallet", "payment"] };\n');
  writeFileSync(join(dir, "nested/index.ts"), 'export const section = { key: "coins", label: "コイン", order: 30, feature: "wallet" };\n');
  writeFileSync(join(dir, "shop.override.ts"), 'export const override = { feature: "plain" };\n');
  writeFileSync(join(dir, "typo.ts"), 'export const section = { key: "typo", label: "x", order: 40, feature: "walet" };\n');
  const plan = planExtensions(root);
  assert.deepEqual(
    itemsOf(plan, "src/featureGate", "rules").map((r) => `${r.name}:${r.fields.settingPaths.join("|")}`),
    ["payment:/admin/settings/shop", "plain:", "wallet:/admin/settings/coins|/admin/settings/shop"],
  );
  assert.match(plan.outputs[GATE_RULES], /\{ \.\.\.rules_payment, name: "payment", tables: \[\], domainApiPaths: \[\], settingPaths: \["\/admin\/settings\/shop"\], cronPaths: \[\], dependsOn: \[\], anyOf: \[\], when: \[\] \},/);
  // 名指しの読めない節(typo)は載せない。並びは住所の順
  assert.match(
    plan.outputs[GATE_RULES],
    /export const settingSections: GatedSettingSection\[\] = \[\n  \{ path: "\/admin\/settings\/coins", features: \["wallet"\] \},\n  \{ path: "\/admin\/settings\/shop", features: \["wallet", "payment"\] \},\n\];/,
  );
  assert.doesNotMatch(plan.outputs[GATE_RULES], /pathPatterns: \[\.\.\.rules_/);
  // この fixture は setting の点 settingSections(overrideOf)を宣言しないので、plugs のフォルダの点が無いことと shop.override.ts の孤立も止まる
  const problems = plan.problems.filter(
    (p) =>
      !p.startsWith("src/domains/core/setting/plugs/settingSections/shop.override.ts: この上書きを受ける点が無い") &&
      !p.startsWith("src/domains/core/setting/plugs/settingSections: plugs の点 settingSections が無い"),
  );
  assert.equal(problems.length, 1, problems.join("\n"));
  assert.match(problems[0], /typo\.ts: feature の "walet" は機能を閉じる規則/);
});

test("常時実行の入口の判定: cron は住所が規則の pathPatterns に入る、alwaysOn の項目は enabled、結線は閉じうるドメインを import しない(例外表は無い、注文 36)", async () => {
  const { judgeAlwaysOnEntries, folderSourcePattern, cronTaskPathOf, rulesNotCoveringCronTask } = await import("../../../src/featureGate/checks/alwaysOnEntries.mjs");
  const rules = [
    { name: "wallet", domains: ["core/wallet"], pathPatterns: ["/wallet", "/api/cron/wallet-ok"] },
    { name: "walletAdmin", domains: ["core/wallet"], pathPatterns: ["/admin/wallet", "/api/cron/wallet-ok"] },
    { name: "sample", domains: ["sample"], pathPatterns: ["/sample", "/api/cron"] },
    { name: "pageOnly", pathPatterns: ["/api/cron/wallet-partial"] },
  ];
  assert.ok(folderSourcePattern("core/wallet").test("@/domains/wallet/x"));
  assert.ok(folderSourcePattern("core/wallet").test("@/domains/core/wallet/x"));
  assert.ok(!folderSourcePattern("core/wallet").test("@/domains/core/walletHistory/x"));
  assert.equal(cronTaskPathOf("src/app/api/cron/wallet-ok/task.ts"), "/api/cron/wallet-ok");
  assert.equal(cronTaskPathOf("src/app/api/other/task.ts"), null);
  assert.deepEqual(rulesNotCoveringCronTask("/api/cron/wallet-ok", ["@/domains/core/wallet/x"], rules), []);
  assert.deepEqual(rulesNotCoveringCronTask("/api/cron/wallet-ng", ["@/domains/wallet/x"], rules), ["wallet", "walletAdmin"]);
  assert.deepEqual(rulesNotCoveringCronTask("/api/cron/any", ["@/domains/sample/x"], rules), [], "セグメント境界の前方一致で覆う");

  const walletTask = `export const cronTask = { run: async () => (await import("@/domains/core/wallet/services/server/x")).run() };`;
  const walletWithEnabled = `export const cronTask = { enabled: () => FLAG, run: async () => (await import("@/domains/core/wallet/services/server/x")).run() };`;
  const cronUnrelated = `export const cronTask = { run: async () => (await import("@/domains/core/auditLog/x")).run() };`;
  const itemOk = `import { x } from "@/domains/core/wallet/services/server/x";\nexport const item = { enabled: () => FLAG, run: x };`;
  const itemNg = `import { x } from "@/domains/core/wallet/services/server/x";\nexport const item = { run: x };`;
  const wire = `import { deps } from "@/domains/sample/services/server/deps";\nexport const x = deps;`;
  const entries = [
    { path: "src/app/api/cron/wallet-ok/task.ts", kind: "cronTask", text: walletTask },
    { path: "src/app/api/cron/wallet-ng/task.ts", kind: "cronTask", text: walletWithEnabled },
    { path: "src/app/api/cron/wallet-partial/task.ts", kind: "cronTask", text: walletTask },
    { path: "src/app/api/cron/other/task.ts", kind: "cronTask", text: cronUnrelated },
    { path: "i/ok.ts", kind: "alwaysOnItem", text: itemOk },
    { path: "i/ng.ts", kind: "alwaysOnItem", text: itemNg },
    { path: "w/unlisted.ts", kind: "wiring", text: wire },
    // 生成された plugs の点の一覧は使う時に gate.plugs で閉じる(注文 30・31): 閉じられるドメインを import しても閉じ漏れでない
    { path: "src/proxies/extensions/proxyDecorators.ts", kind: "plugsList", text: wire },
  ];
  const { problems, hits } = judgeAlwaysOnEntries(entries, rules);
  assert.deepEqual(hits.map((h) => h.split(":")[0]), [
    "src/app/api/cron/wallet-ok/task.ts",
    "src/app/api/cron/wallet-ng/task.ts",
    "src/app/api/cron/wallet-partial/task.ts",
    "i/ok.ts",
    "i/ng.ts",
    "w/unlisted.ts",
    "src/proxies/extensions/proxyDecorators.ts",
  ]);
  assert.deepEqual(
    problems.map((p) => p.split(":")[0]).sort(),
    [
      "i/ng.ts",
      "src/app/api/cron/wallet-ng/task.ts", // enabled があっても住所を覆わなければ失敗(規則 2 つ分)
      "src/app/api/cron/wallet-ng/task.ts",
      "src/app/api/cron/wallet-partial/task.ts", // 表を持たない規則が覆っても足りない(2 規則とも覆わない)
      "src/app/api/cron/wallet-partial/task.ts",
      "w/unlisted.ts",
    ],
  );
  assert.match(problems.find((p) => p.startsWith("src/app/api/cron/wallet-ng/")), /規則 wallet の pathPatterns が \/api\/cron\/wallet-ng を覆わない.*cronPaths に導く: pnpm generate extensions/);
  const oneMissing = judgeAlwaysOnEntries(
    [{ path: "src/app/api/cron/wallet-ok/task.ts", kind: "cronTask", text: walletTask }],
    [rules[0], { ...rules[1], pathPatterns: ["/admin/wallet"] }],
  );
  assert.deepEqual(oneMissing.problems.length, 1, "同じフォルダを持つ規則の 1 つでも覆わなければ失敗");
  assert.match(oneMissing.problems[0], /規則 walletAdmin/);
  // 規則の when の生成物(src/featureGate/extensions/whenInputs.ts)がドメインの config を読むのは閉じ漏れでない(D28)。規則のファイル・config の外・ほかの結線は今までどおり
  const configImport = 'import { WALLET_CONFIG } from "@/domains/core/wallet/config";\nexport const rule = {};\n';
  const ruleConfig = judgeAlwaysOnEntries(
    [
      { path: "src/featureGate/extensions/whenInputs.ts", kind: "wiring", text: configImport },
      { path: "src/featureGate/rules/wallet.ts", kind: "wiring", text: configImport },
      { path: "src/featureGate/extensions/whenInputs.ts", kind: "wiring", text: 'import { walletService } from "@/domains/core/wallet/services/server/walletService";\n' },
      { path: "src/wiring/walletConfig.ts", kind: "wiring", text: configImport },
    ],
    rules,
  );
  assert.deepEqual(ruleConfig.problems.map((p) => p.split(":")[0]), ["src/featureGate/rules/wallet.ts", "src/featureGate/extensions/whenInputs.ts", "src/wiring/walletConfig.ts"]);
});

