// scripts/proxies/proxyFrame.test.mjs
// proxy の枠(src/proxies/<名前>.ts の走査と生成一覧)と常時実行の入口の判定の回帰テスト。一時ディレクトリで動かす。
// 生成器は汎用の拡張点の生成器(scripts/extensions/)で、宣言は実物の src/proxies/extensionPoints.ts をそのまま使う。
// - 項目 = export const handler / decorator を 1 つ持つ直下の .ts、骨組み・枠・テスト・サブフォルダ・.mjs は見ない
// - 並びはファイル名の順、上流と fork の項目はどちらも印なしで同じ枠に入る
// - 失敗: 旧い fork の名前の印(移し方を案内) / 両方 / どちらも無い / 名前の形
// - 機能を閉じる規則: features のフォルダから tables を導く(derive featureTables)、失敗の各条件
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
const SKELETON_FILES = ["maintenance.ts", "demoMode.ts", "featureGate.ts", "redirect.ts", "attribution.ts", "inviteLink.ts"];
const HANDLERS = "src/proxies/extensions/handlers.ts";
const DECORATORS = "src/proxies/extensions/decorators.ts";
const GATE_RULES = "src/proxies/extensions/featureGateRules.ts";

/** fork(acme、祖先 parent)、骨組み + 渡したファイルを置いた一時リポ */
function fixture(files) {
  const root = mkdtempSync(join(tmpdir(), "proxy-frame-"));
  mkdirSync(join(root, ".claude/rules"), { recursive: true });
  writeFileSync(join(root, ".claude/rules/project.md"), "fork_id: acme\n");
  mkdirSync(join(root, ".notices/applied"), { recursive: true });
  writeFileSync(join(root, ".notices/applied/parent.md"), "");
  const dir = join(root, "src/proxies");
  mkdirSync(join(dir, "extensions"), { recursive: true });
  mkdirSync(join(dir, "featureGateRules"), { recursive: true });
  writeFileSync(join(dir, "extensionPoints.ts"), DECLARATION);
  for (const name of [...SKELETON_FILES, "index.ts", "types.ts"]) writeFileSync(join(dir, name), "export const somethingProxy = () => {};\n");
  writeFileSync(join(dir, "pathPattern.mjs"), "export const x = 1;\n");
  writeFileSync(join(dir, "proxy.test.mts"), "export const handler = 1;\n");
  for (const [name, text] of Object.entries(files)) writeFileSync(join(dir, name), text);
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

test("規則: featureGateRules/ の export const rule をファイル名順に集め、旧い x.<fork の名前>.ts は止める", () => {
  const R = 'export const rule: FeatureGateRule = { pathPatterns: ["/x"], enabled: () => true };\n';
  const plan = planExtensions(
    fixture({ "featureGateRules/wallet.ts": R, "featureGateRules/acmeShop.ts": R, "featureGateRules/alpha.ts": R, "featureGateRules/helper.ts": "export const x = 1;\n", "featureGateRules/beta.other.ts": R }),
  );
  assert.deepEqual(names(plan, "featureGateRules"), ["acmeShop", "alpha", "wallet"]);
  assert.equal(plan.problems.length, 2, plan.problems.join("\n"));
  assert.ok(plan.problems.some((p) => p.includes("helper.ts") && p.includes("export const rule")));
  assert.ok(plan.problems.some((p) => p.includes("beta.other.ts") && p.includes("印なしの beta.ts に改名")));
  assert.match(plan.outputs[GATE_RULES], /import \{ rule as featureGateRules_alpha \} from "@\/proxies\/featureGateRules\/alpha";/);
  assert.match(plan.outputs[GATE_RULES], /export const featureGateRules: GatedFeatureRule\[\] = \[\n  \{ \.\.\.featureGateRules_acmeShop, tables: \[\] \},\n  \{ \.\.\.featureGateRules_alpha, tables: \[\] \},\n  \{ \.\.\.featureGateRules_wallet, tables: \[\] \},\n\];/);
});

test("規則の features: フォルダの pgTable から表を導き(fork が上流のフォルダに足した表も)、失敗の各条件で止まる", () => {
  const rule = (body) => `export const rule: FeatureGateRule = { pathPatterns: ["/x"], ${body} enabled: () => true };\n`;
  const root = fixture({
    "featureGateRules/wallet.ts": rule('features: [\n    "core/wallet",\n    "core/walletHistory",\n  ],'),
    "featureGateRules/plain.ts": rule(""),
    "featureGateRules/handWritten.ts": rule('tables: ["wallets"],'),
    "featureGateRules/variable.ts": rule("features: FOLDERS,"),
    "featureGateRules/notLiteral.ts": rule("features: [FOLDER],"),
    "featureGateRules/missing.ts": rule('features: ["core/nowhere"],'),
    "featureGateRules/noTables.ts": rule('features: ["core/empty"],'),
  });
  const feat = (name, tables) => {
    const d = join(root, "src/features", name, "entities");
    mkdirSync(d, { recursive: true });
    writeFileSync(join(d, "drizzle.ts"), tables.map((t, i) => `export const T${i} = pgTable("${t}", {});\n`).join(""));
  };
  feat("core/wallet", ["wallets", "wallet_lots"]);
  feat("core/walletHistory", ["wallet_histories"]);
  feat("core/empty", []);
  // fork が上流のフォルダに足した表
  writeFileSync(join(root, "src/features/core/wallet/entities/forkExtra.ts"), 'export const X = pgTable("wallet_fork_extras", {});\n');

  const plan = planExtensions(root);
  assert.deepEqual(
    itemsOf(plan, "src/proxies", "featureGateRules").map((r) => `${r.name}:${r.fields.tables.join("|")}`),
    ["plain:", "wallet:wallets|wallet_lots|wallet_fork_extras|wallet_histories"],
  );
  const reasons = Object.fromEntries(["handWritten", "variable", "notLiteral", "missing", "noTables"].map((n) => [n, plan.problems.find((p) => p.includes(`/${n}.ts`)) ?? ""]));
  assert.match(reasons.handWritten, /tables を手書き/);
  assert.match(reasons.variable, /文字列リテラルの配列でない/);
  assert.match(reasons.notLiteral, /文字列リテラルでない/);
  assert.match(reasons.missing, /無いフォルダ/);
  assert.match(reasons.noTables, /pgTable が無い/);
  assert.equal(plan.problems.length, 5, plan.problems.join("\n"));
  assert.match(plan.outputs[GATE_RULES], /\{ \.\.\.featureGateRules_wallet, tables: \["wallets", "wallet_lots", "wallet_fork_extras", "wallet_histories"\] \},/);
});

test("常時実行の入口の判定: cron は enabled、登録表は条件つき spread、結線は例外表(縮む表)", async () => {
  const { judgeAlwaysOnEntries, folderSourcePattern } = await import("./alwaysOnEntries.mjs");
  const folders = ["core/wallet", "sample"];
  assert.ok(folderSourcePattern("core/wallet").test("@/features/wallet/x"));
  assert.ok(folderSourcePattern("core/wallet").test("@/features/core/wallet/x"));
  assert.ok(!folderSourcePattern("core/wallet").test("@/features/core/walletHistory/x"));

  const cronOk = `export const cronTask = { enabled: () => FLAG, run: async () => (await import("@/features/core/wallet/services/server/x")).run() };`;
  const cronNg = `export const cronTask = { run: async () => (await import("@/features/core/wallet/services/server/x")).run() };`;
  const cronUnrelated = `export const cronTask = { run: async () => (await import("@/features/core/auditLog/x")).run() };`;
  const regOk = `import { clear } from "@/features/core/wallet/services/server/clear";\nimport type { T } from "@/features/sample/types";\nexport const h = [\n  ...(FLAG.enabled ? [clear] : []),\n];`;
  const regNg = `import { clear } from "@/features/core/wallet/services/server/clear";\nexport const h = [clear];`;
  const regNamespace = `import * as w from "@/features/core/wallet";\nexport const h = [...(F ? [w.x] : [])];`;
  const wire = `import { deps } from "@/features/sample/services/server/deps";\nexport const x = deps;`;
  const entries = [
    { path: "c/ok/task.ts", kind: "cron", text: cronOk },
    { path: "c/ng/task.ts", kind: "cron", text: cronNg },
    { path: "c/other/task.ts", kind: "cron", text: cronUnrelated },
    { path: "r/ok.ts", kind: "registry", text: regOk },
    { path: "r/ng.ts", kind: "registry", text: regNg },
    { path: "r/ns.ts", kind: "registry", text: regNamespace },
    { path: "w/listed.ts", kind: "wiring", text: wire },
    { path: "w/unlisted.ts", kind: "wiring", text: wire },
  ];
  const { problems, hits } = judgeAlwaysOnEntries(entries, folders, { "w/listed.ts": "理由", "w/gone.ts": "もう無い" });
  assert.deepEqual(hits.map((h) => h.split(":")[0]), ["c/ok/task.ts", "c/ng/task.ts", "r/ok.ts", "r/ng.ts", "r/ns.ts", "w/listed.ts", "w/unlisted.ts"]);
  assert.deepEqual(
    problems.map((p) => p.split(":")[0]).sort(),
    ["c/ng/task.ts", "r/ng.ts", "r/ns.ts", "w/gone.ts", "w/unlisted.ts"],
  );
});

test("常時実行の入口の fork の口(L1.24): alwaysOnExceptions/<名前>.mjs は 1 項目 1 ファイル(exception か registry)、reason 必須、旧い alwaysOnExceptions.<x>.mjs は止める", async () => {
  const { readForkAlwaysOn, staleAlwaysOnFiles, judgeAlwaysOnEntries } = await import("./alwaysOnEntries.mjs");
  const file = (name, mod) => ({ name, load: async () => mod });
  const ok = await readForkAlwaysOn([
    file("deviceWiring.mjs", { exception: { file: "src/wiring/x.ts", reason: "端末の解決は route でだけ走る" } }),
    file("cleanup.mjs", { registry: { file: "src/registry/cleanup.ts", reason: "退会の後片付け" } }),
  ]);
  assert.deepEqual(ok.problems, []);
  assert.deepEqual(ok.exceptions, { "src/wiring/x.ts": "端末の解決は route でだけ走る" });
  assert.deepEqual(ok.registries, ["src/registry/cleanup.ts"]);

  const ng = await readForkAlwaysOn([
    file("blank.mjs", { exception: { file: "src/wiring/y.ts", reason: " " } }),
    file("noFile.mjs", { registry: { reason: "x" } }),
    file("both.mjs", { exception: { file: "a", reason: "r" }, registry: { file: "b", reason: "r" } }),
    file("none.mjs", { exceptions: [] }),
    file("old.acme.mjs", { exception: { file: "a", reason: "r" } }),
  ]);
  assert.equal(ng.problems.length, 5, ng.problems.join("\n"));
  assert.deepEqual(ng.exceptions, {});

  const stale = staleAlwaysOnFiles(["alwaysOnEntries.mjs", "alwaysOnExceptions.acme.mjs", "proxyFrame.test.mjs"]);
  assert.equal(stale.length, 1);
  assert.match(stale[0], /alwaysOnExceptions\.acme\.mjs.*alwaysOnExceptions\/<名前>\.mjs に改名.*shared-shelf marker migration notice/);

  // fork の例外の行にも縮む表の規則(当たらない行は失敗)
  const { problems } = judgeAlwaysOnEntries([], ["core/wallet"], ok.exceptions);
  assert.deepEqual(problems.map((p) => p.split(":")[0]), ["src/wiring/x.ts"]);
});
