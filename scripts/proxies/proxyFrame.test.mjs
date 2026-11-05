// scripts/proxies/proxyFrame.test.mjs
// proxy の枠(src/proxies/<名前>.ts の走査と生成一覧)と常時実行の入口の判定の回帰テスト。一時ディレクトリで動かす。
// 生成器は汎用の拡張点の生成器(scripts/extensions/)で、宣言は実物の src/proxies/extensionPoints.ts をそのまま使う。
// - 項目 = export const handler / decorator を 1 つ持つ直下の .ts、骨組み・枠・テスト・サブフォルダ・.mjs は見ない
// - 並びはファイル名の順、上流と fork の項目はどちらも印なしで同じ枠に入る
// - 失敗: 旧い fork の名前の印(移し方を案内) / 両方 / どちらも無い / 名前の形
// - 機能を閉じる規則(門番 src/featureGate/rules/、宣言は実物の src/featureGate/extensionPoints.ts): features のフォルダから tables を導き、名前を付ける(derive featureTables)、失敗の各条件
// 生成一覧の一致(実リポ)は pnpm test:extensions と extensions:check
// 実行: pnpm test:proxy-frame

import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

import { itemsOf, planExtensions } from "../extensions/extensions.mjs";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const DECLARATION = readFileSync(join(repoRoot, "src/proxies/extensionPoints.ts"), "utf8");
const GATE_DECLARATION = readFileSync(join(repoRoot, "src/featureGate/extensionPoints.ts"), "utf8");
const SKELETON_FILES = ["maintenance.ts", "demoMode.ts", "featureGate.ts", "redirect.ts", "attribution.ts", "inviteLink.ts"];
const HANDLERS = "src/proxies/extensions/handlers.ts";
const DECORATORS = "src/proxies/extensions/decorators.ts";
const GATE_RULES = "src/featureGate/extensions/rules.ts";

/** fork(acme、祖先 parent)、骨組み + 渡したファイルを置いた一時リポ */
function fixture(files) {
  const root = mkdtempSync(join(tmpdir(), "proxy-frame-"));
  mkdirSync(join(root, ".claude/rules"), { recursive: true });
  writeFileSync(join(root, ".claude/rules/project.md"), "fork_id: acme\n");
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
  // "rules/<名前>.ts" は門番の受け口、それ以外は src/proxies の直下
  for (const [name, text] of Object.entries(files)) writeFileSync(join(name.startsWith("rules/") ? gateDir : dir, name), text);
  return root;
}

const H = "export const handler: ProxyHandler = async (request, ctx) => {};\n";
const D = "export const decorator: ProxyResponseDecorator = (request, response, ctx) => {};\n";
const names = (plan, point) => itemsOf(plan, "src/proxies", point).map((i) => i.name);

test("走査: 直下の .ts の handler / decorator だけをファイル名順に集め、骨組み・枠・テスト・サブフォルダ・.mjs は見ない", () => {
  const plan = planExtensions(fixture({ "zeta.ts": H, "alpha.ts": H, "beta.ts": D, "gamma.ts": D }));
  assert.deepEqual(plan.problems, []);
  assert.deepEqual(names(plan, "handlers"), ["alpha", "zeta"]);
  assert.deepEqual(names(plan, "decorators"), ["beta", "gamma"]);
  assert.match(plan.outputs[HANDLERS], /import \{ handler as handlers_alpha \} from "@\/proxies\/alpha";\nimport \{ handler as handlers_zeta \} from "@\/proxies\/zeta";/);
  assert.match(plan.outputs[HANDLERS], /export const handlers: ProxyHandler\[\] = \[\n  handlers_alpha,\n  handlers_zeta,\n\];/);
  assert.match(plan.outputs[DECORATORS], /export const decorators: ProxyResponseDecorator\[\] = \[\n  decorators_beta,\n  decorators_gamma,\n\];/);
});

test("失敗: 旧い fork の名前の印・両方・どちらも無い・名前の形", () => {
  const plan = planExtensions(fixture({ "a.other.ts": H, "both.ts": H + D, "helper.ts": "export function helper() {}\n", "x.a.b.ts": H, "1x.ts": H, "ok.ts": H }));
  assert.deepEqual(names(plan, "handlers"), ["ok"]);
  assert.equal(plan.problems.length, 5, plan.problems.join("\n"));
  assert.ok(plan.problems.some((p) => p.includes("a.other.ts") && p.includes("印なしの a.ts に改名")));
  assert.ok(plan.problems.some((p) => p.includes("both.ts") && p.includes("両方")));
  assert.ok(plan.problems.some((p) => p.includes("helper.ts") && p.includes("無い")));
  assert.ok(plan.problems.some((p) => p.includes("x.a.b.ts") && p.includes("印なしの x.ts に改名")));
  assert.ok(plan.problems.some((p) => p.includes("1x.ts") && p.includes("名前の形")));
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
  assert.match(plan.outputs[GATE_RULES], /export const rules: GatedFeatureRule\[\] = \[\n  \{ \.\.\.rules_acmeShop, name: "acmeShop", tables: \[\], domainApiPaths: \[\] \},\n  \{ \.\.\.rules_alpha, name: "alpha", tables: \[\], domainApiPaths: \[\] \},\n  \{ \.\.\.rules_wallet, name: "wallet", tables: \[\], domainApiPaths: \[\] \},\n\];/);
});

test("規則の features: フォルダの pgTable から表と汎用 API の住所(domainEntry のキー)を導き(fork が上流のフォルダに足した表も)、失敗の各条件で止まる", () => {
  const rule = (body) => `export const rule: FeatureGateRule = { pathPatterns: ["/x"], ${body} enabled: () => true };\n`;
  const root = fixture({
    "rules/wallet.ts": rule('features: [\n    "core/wallet",\n    "core/walletHistory",\n  ],'),
    "rules/plain.ts": rule(""),
    "rules/handWritten.ts": rule('tables: ["wallets"],'),
    "rules/variable.ts": rule("features: FOLDERS,"),
    "rules/notLiteral.ts": rule("features: [FOLDER],"),
    "rules/missing.ts": rule('features: ["core/nowhere"],'),
    "rules/noTables.ts": rule('features: ["core/empty"],'),
    "rules/handApi.ts": rule('domainApiPaths: ["/api/x"],'),
    "rules/brokenEntry.ts": rule('features: ["core/broken"],'),
    "rules/noEntry.ts": rule('features: ["core/quota"],'),
  });
  const feat = (name, tables) => {
    const d = join(root, "src/features", name, "entities");
    mkdirSync(d, { recursive: true });
    writeFileSync(join(d, "drizzle.ts"), tables.map((t, i) => `export const T${i} = pgTable("${t}", {});\n`).join(""));
  };
  feat("core/wallet", ["wallets", "wallet_lots"]);
  feat("core/walletHistory", ["wallet_histories"]);
  feat("core/empty", []);
  feat("core/broken", ["brokens"]);
  feat("core/quota", ["quotas"]);
  const entry = (name, text) => {
    const d = join(root, "src/features", name, "services/server");
    mkdirSync(d, { recursive: true });
    writeFileSync(join(d, "domainEntry.ts"), text);
  };
  // キー 1 つ・複数・壊れた entry(export が無い)。core/quota は entry 無し(住所を足さない)
  entry("core/wallet", "export const domainEntries = {\n  wallet: { table: \"wallets\" },\n} satisfies DomainEntries;\n");
  entry("core/walletHistory", "export const domainEntries = {\n  walletHistory: { table: \"wallet_histories\" },\n  walletLot: { table: \"wallet_lots\" },\n} satisfies DomainEntries;\n");
  entry("core/broken", "export const somethingElse = {};\n");
  // fork が上流のフォルダに足した表
  writeFileSync(join(root, "src/features/core/wallet/entities/forkExtra.ts"), 'export const X = pgTable("wallet_fork_extras", {});\n');

  const plan = planExtensions(root);
  assert.deepEqual(
    itemsOf(plan, "src/featureGate", "rules").map((r) => `${r.name}:${r.fields.tables.join("|")}`),
    ["noEntry:quotas", "plain:", "wallet:wallets|wallet_lots|wallet_fork_extras|wallet_histories"],
  );
  assert.deepEqual(
    itemsOf(plan, "src/featureGate", "rules").map((r) => `${r.name}:${r.fields.domainApiPaths.join("|")}`),
    ["noEntry:", "plain:", "wallet:/api/wallet|/api/walletHistory|/api/walletLot"],
  );
  const reasons = Object.fromEntries(["handWritten", "variable", "notLiteral", "missing", "noTables", "handApi", "brokenEntry"].map((n) => [n, plan.problems.find((p) => p.includes(`/${n}.ts`)) ?? ""]));
  assert.match(reasons.handWritten, /tables を手書き/);
  assert.match(reasons.variable, /文字列リテラルの配列でない/);
  assert.match(reasons.notLiteral, /文字列リテラルでない/);
  assert.match(reasons.missing, /無いフォルダ/);
  assert.match(reasons.noTables, /pgTable が無い/);
  assert.match(reasons.handApi, /domainApiPaths を手書き/);
  assert.match(reasons.brokenEntry, /domainEntries が読めない/);
  assert.equal(plan.problems.length, 7, plan.problems.join("\n"));
  assert.match(
    plan.outputs[GATE_RULES],
    /\{ \.\.\.rules_wallet, name: "wallet", tables: \["wallets", "wallet_lots", "wallet_fork_extras", "wallet_histories"\], domainApiPaths: \["\/api\/wallet", "\/api\/walletHistory", "\/api\/walletLot"\], pathPatterns: \[\.\.\.rules_wallet\.pathPatterns, "\/api\/wallet", "\/api\/walletHistory", "\/api\/walletLot"\] \},/,
  );
  assert.match(plan.outputs[GATE_RULES], /\{ \.\.\.rules_noEntry, name: "noEntry", tables: \["quotas"\], domainApiPaths: \[\] \},/);
});

test("常時実行の入口の判定: cron は住所が規則の pathPatterns に入る、alwaysOn の項目は enabled、登録表は条件つき spread、結線は例外表(縮む表)", async () => {
  const { judgeAlwaysOnEntries, folderSourcePattern, cronTaskPathOf, rulesNotCoveringCronTask } = await import("../../src/featureGate/checks/alwaysOnEntries.mjs");
  const rules = [
    { name: "wallet", features: ["core/wallet"], pathPatterns: ["/wallet", "/api/cron/wallet-ok"] },
    { name: "walletAdmin", features: ["core/wallet"], pathPatterns: ["/admin/wallet", "/api/cron/wallet-ok"] },
    { name: "sample", features: ["sample"], pathPatterns: ["/sample", "/api/cron"] },
    { name: "pageOnly", pathPatterns: ["/api/cron/wallet-partial"] },
  ];
  assert.ok(folderSourcePattern("core/wallet").test("@/features/wallet/x"));
  assert.ok(folderSourcePattern("core/wallet").test("@/features/core/wallet/x"));
  assert.ok(!folderSourcePattern("core/wallet").test("@/features/core/walletHistory/x"));
  assert.equal(cronTaskPathOf("src/app/api/cron/wallet-ok/task.ts"), "/api/cron/wallet-ok");
  assert.equal(cronTaskPathOf("src/app/api/other/task.ts"), null);
  assert.deepEqual(rulesNotCoveringCronTask("/api/cron/wallet-ok", ["@/features/core/wallet/x"], rules), []);
  assert.deepEqual(rulesNotCoveringCronTask("/api/cron/wallet-ng", ["@/features/wallet/x"], rules), ["wallet", "walletAdmin"]);
  assert.deepEqual(rulesNotCoveringCronTask("/api/cron/any", ["@/features/sample/x"], rules), [], "セグメント境界の前方一致で覆う");

  const walletTask = `export const cronTask = { run: async () => (await import("@/features/core/wallet/services/server/x")).run() };`;
  const walletWithEnabled = `export const cronTask = { enabled: () => FLAG, run: async () => (await import("@/features/core/wallet/services/server/x")).run() };`;
  const cronUnrelated = `export const cronTask = { run: async () => (await import("@/features/core/auditLog/x")).run() };`;
  const itemOk = `import { x } from "@/features/core/wallet/services/server/x";\nexport const item = { enabled: () => FLAG, run: x };`;
  const itemNg = `import { x } from "@/features/core/wallet/services/server/x";\nexport const item = { run: x };`;
  const regOk = `import { clear } from "@/features/core/wallet/services/server/clear";\nimport type { T } from "@/features/sample/types";\nexport const h = [\n  ...(FLAG.enabled ? [clear] : []),\n];`;
  const regNg = `import { clear } from "@/features/core/wallet/services/server/clear";\nexport const h = [clear];`;
  const regNamespace = `import * as w from "@/features/core/wallet";\nexport const h = [...(F ? [w.x] : [])];`;
  const wire = `import { deps } from "@/features/sample/services/server/deps";\nexport const x = deps;`;
  const entries = [
    { path: "src/app/api/cron/wallet-ok/task.ts", kind: "cronTask", text: walletTask },
    { path: "src/app/api/cron/wallet-ng/task.ts", kind: "cronTask", text: walletWithEnabled },
    { path: "src/app/api/cron/wallet-partial/task.ts", kind: "cronTask", text: walletTask },
    { path: "src/app/api/cron/other/task.ts", kind: "cronTask", text: cronUnrelated },
    { path: "i/ok.ts", kind: "alwaysOnItem", text: itemOk },
    { path: "i/ng.ts", kind: "alwaysOnItem", text: itemNg },
    { path: "r/ok.ts", kind: "registry", text: regOk },
    { path: "r/ng.ts", kind: "registry", text: regNg },
    { path: "r/ns.ts", kind: "registry", text: regNamespace },
    { path: "w/listed.ts", kind: "wiring", text: wire },
    { path: "w/unlisted.ts", kind: "wiring", text: wire },
  ];
  const { problems, hits } = judgeAlwaysOnEntries(entries, rules, { "w/listed.ts": "理由", "w/gone.ts": "もう無い" });
  assert.deepEqual(hits.map((h) => h.split(":")[0]), [
    "src/app/api/cron/wallet-ok/task.ts",
    "src/app/api/cron/wallet-ng/task.ts",
    "src/app/api/cron/wallet-partial/task.ts",
    "i/ok.ts",
    "i/ng.ts",
    "r/ok.ts",
    "r/ng.ts",
    "r/ns.ts",
    "w/listed.ts",
    "w/unlisted.ts",
  ]);
  assert.deepEqual(
    problems.map((p) => p.split(":")[0]).sort(),
    [
      "i/ng.ts",
      "r/ng.ts",
      "r/ns.ts",
      "src/app/api/cron/wallet-ng/task.ts", // enabled があっても住所を覆わなければ失敗(規則 2 つ分)
      "src/app/api/cron/wallet-ng/task.ts",
      "src/app/api/cron/wallet-partial/task.ts", // 表を持たない規則が覆っても足りない(2 規則とも覆わない)
      "src/app/api/cron/wallet-partial/task.ts",
      "w/gone.ts",
      "w/unlisted.ts",
    ],
  );
  assert.match(problems.find((p) => p.startsWith("src/app/api/cron/wallet-ng/")), /規則 wallet の pathPatterns が \/api\/cron\/wallet-ng を覆わない.*"\/api\/cron\/wallet-ng" を足す/);
  const oneMissing = judgeAlwaysOnEntries(
    [{ path: "src/app/api/cron/wallet-ok/task.ts", kind: "cronTask", text: walletTask }],
    [rules[0], { ...rules[1], pathPatterns: ["/admin/wallet"] }],
    {},
  );
  assert.deepEqual(oneMissing.problems.length, 1, "同じフォルダを持つ規則の 1 つでも覆わなければ失敗");
  assert.match(oneMissing.problems[0], /規則 walletAdmin/);
});

test("常時実行の入口の fork の口(L1.24): src/featureGate/alwaysOnExceptions/<名前>.ts は 1 項目 1 ファイル(exception か registry)、reason 必須、旧い置き場は止める", async () => {
  const { readForkAlwaysOn, staleAlwaysOnFiles, judgeAlwaysOnEntries } = await import("../../src/featureGate/checks/alwaysOnEntries.mjs");
  const ok = readForkAlwaysOn({
    exceptions: [{ file: "src/wiring/x.ts", reason: "端末の解決は route でだけ走る" }],
    registries: [{ file: "src/registry/cleanup.ts", reason: "退会の後片付け" }],
  });
  assert.deepEqual(ok.problems, []);
  assert.deepEqual(ok.exceptions, { "src/wiring/x.ts": "端末の解決は route でだけ走る" });
  assert.deepEqual(ok.registries, ["src/registry/cleanup.ts"]);

  const ng = readForkAlwaysOn({
    exceptions: [{ file: "src/wiring/y.ts", reason: " " }, { file: "", reason: "r" }],
    registries: [{ reason: "x" }],
  });
  assert.equal(ng.problems.length, 3, ng.problems.join("\n"));
  assert.deepEqual(ng.exceptions, {});

  // 受け口の走査(生成器): exception と registry の両方・どちらも無い・旧い印は止まる、.mjs は項目でない
  const X = 'export const exception: AlwaysOnException = { file: "src/wiring/x.ts", reason: "r" };\n';
  const Y = 'export const registry: AlwaysOnException = { file: "src/registry/y.ts", reason: "r" };\n';
  const root = fixture({});
  const itemDir = join(root, "src/featureGate/alwaysOnExceptions");
  mkdirSync(itemDir, { recursive: true });
  for (const [name, text] of Object.entries({ "wire.ts": X, "cleanup.ts": Y, "both.ts": X + Y, "none.ts": "export const x = 1;\n", "old.acme.ts": X, "legacy.mjs": X })) writeFileSync(join(itemDir, name), text);
  const plan = planExtensions(root);
  assert.deepEqual(itemsOf(plan, "src/featureGate", "alwaysOnExceptions").map((i) => i.name), ["wire"]);
  assert.deepEqual(itemsOf(plan, "src/featureGate", "alwaysOnRegistries").map((i) => i.name), ["cleanup"]);
  assert.equal(plan.problems.length, 3, plan.problems.join("\n"));

  const stale = staleAlwaysOnFiles(["alwaysOnEntries.mjs", "alwaysOnExceptions.acme.mjs", "proxyFrame.test.mjs"], ["deviceWiring.mjs"]);
  assert.equal(stale.length, 2);
  assert.match(stale[0], /alwaysOnExceptions\.acme\.mjs.*alwaysOnExceptions\/<名前>\.mjs に改名.*shared-shelf marker migration notice.*src\/featureGate\/alwaysOnExceptions/);
  assert.match(stale[1], /scripts\/proxies\/alwaysOnExceptions\/deviceWiring\.mjs: 置き場が src\/featureGate\/alwaysOnExceptions\/<名前>\.ts に移った/);

  // fork の例外の行にも縮む表の規則(当たらない行は失敗)
  const { problems } = judgeAlwaysOnEntries([], [{ name: "wallet", features: ["core/wallet"], pathPatterns: ["/wallet"] }], ok.exceptions);
  assert.deepEqual(problems.map((p) => p.split(":")[0]), ["src/wiring/x.ts"]);
});
