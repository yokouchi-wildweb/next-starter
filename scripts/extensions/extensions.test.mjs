// scripts/extensions/extensions.test.mjs
// 拡張点の生成器(./declarations.mjs・./extensions.mjs)の回帰テスト。一時ディレクトリの fixture で動かす。
// - 宣言はリテラルだけ(式・未知のキー・点の名前の形は失敗)、src の下ならどこでも読む(lib の target: "wiring" も)
// - 項目はファイル(<名前>[.<fork の名前>].ts(x))かフォルダ(<名前>[.<fork の名前>]/index.ts(x))、名前の順
// - 失敗: 宣言に無い fork の名前 / 印が無い / 同じ名前のファイルとフォルダ / fork の点が上流と同名
// - 描画: eager の配列・key の Record・lazy の import・wiring の 1 本・共通のヘッダ
// - check: ずれ・extensions/ の手で置いたファイル(ヘッダ無し)・宣言の消えた古い一覧
// - 1 行スイッチ(./switches.mjs)の形と、上流は override を出荷しない(./overrides.mjs)
// 実行: pnpm test:extensions

import assert from "node:assert/strict";
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

import { readDeclaration } from "./declarations.mjs";
import { checkOverrides } from "./overrides.mjs";
import { checkSwitches } from "./switches.mjs";
import { headerFor, itemsOf, planExtensions, staleOutputs, strayExtensionFiles } from "./extensions.mjs";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");

/** fork の名前 acme(祖先 parent)の一時リポにファイルを置く */
function fixture(files) {
  const root = mkdtempSync(join(tmpdir(), "extensions-"));
  const put = (path, text) => {
    mkdirSync(dirname(join(root, path)), { recursive: true });
    writeFileSync(join(root, path), text);
  };
  put(".claude/rules/project.md", "fork_id: acme\n");
  put(".notices/applied/parent.md", "");
  put("src/lib/CATALOG.md", "## next-starter\n\n## parent\n\n## acme\n");
  for (const [path, text] of Object.entries(files)) put(path, text);
  return root;
}

const point = (body) => `export const extensionPoints = {\n${body}\n};\n`;
const MILESTONES = `  definitions: { dir: "milestones", export: "milestone", type: { from: "@/features/milestone/types", name: "MilestoneDefinition" }, side: "server" },`;

test("宣言: リテラル以外・未知のキー・点の名前の形・欠けたキーは失敗", () => {
  const bad = (body) => readDeclaration("x/extensionPoints.ts", point(body)).problems;
  assert.deepEqual(readDeclaration("x/extensionPoints.ts", point(MILESTONES)).problems, []);
  assert.match(bad(`  definitions: { dir: DIR, export: "m", type: { from: "a", name: "T" }, side: "server" },`)[0], /リテラルでない値\(DIR\)/);
  assert.match(bad(`  definitions: { dir: "m", export: "m", type: { from: "a", name: "T" }, side: "server", ...rest },`)[0], /リテラルでない書き方/);
  assert.match(bad(`  definitions: { dir: \`m\${x}\`, export: "m", type: { from: "a", name: "T" }, side: "server" },`)[0], /リテラルでない値/);
  assert.match(bad(`  definitions: { dir: "m", export: "m", type: { from: "a", name: "T" }, side: "server", order: 1 },`)[0], /未知のキー order/);
  assert.match(bad(`  Definitions: { dir: "m", export: "m", type: { from: "a", name: "T" }, side: "server" },`)[0], /英小文字始まり/);
  assert.ok(bad(`  definitions: { dir: "../m", export: "m", type: { from: "a" }, side: "edge", derive: "mine" },`).length >= 4);
  assert.match(readDeclaration("x/extensionPoints.ts", "export const other = {};\n").problems[0], /export const extensionPoints/);
});

test("走査: ファイルとフォルダの 2 形・fork の名前・名前の順。src の下のどこでも宣言を読む", () => {
  const M = "export const milestone = { id: 1 };\n";
  const root = fixture({
    "src/features/milestone/extensionPoints.ts": point(MILESTONES),
    "src/features/milestone/milestones/zeta.ts": M,
    "src/features/milestone/milestones/alpha.acme.ts": M,
    "src/features/milestone/milestones/beta/index.tsx": M,
    "src/features/milestone/milestones/beta/part.ts": "export const x = 1;\n",
    "src/features/milestone/milestones/gamma.parent.tsx": M,
    "src/features/milestone/milestones/zeta.test.ts": M,
    "src/features/milestone/milestones/notes.md": "x",
  });
  const plan = planExtensions(root);
  assert.deepEqual(plan.problems, []);
  assert.deepEqual(
    itemsOf(plan, "src/features/milestone", "definitions").map((i) => `${i.name}:${i.forkId}`),
    ["alpha.acme:acme", "beta:null", "gamma.parent:parent", "zeta:null"],
  );
  const out = plan.outputs["src/features/milestone/extensions/definitions.ts"];
  assert.ok(out.startsWith(`${headerFor("src/features/milestone/extensionPoints.ts")}\n`));
  assert.match(out, /import type \{ MilestoneDefinition \} from "@\/features\/milestone\/types";/);
  assert.match(out, /import \{ milestone as alpha_acme \} from "@\/features\/milestone\/milestones\/alpha\.acme";/);
  assert.match(out, /import \{ milestone as beta \} from "@\/features\/milestone\/milestones\/beta";/);
  assert.match(out, /export const definitions: MilestoneDefinition\[\] = \[\n  alpha_acme,\n  beta,\n  gamma_parent,\n  zeta,\n\];/);
});

test("失敗: 宣言に無い fork の名前・印が無い・index の無いフォルダ・同じ名前のファイルとフォルダ・名前の形", () => {
  const M = "export const milestone = 1;\n";
  const root = fixture({
    "src/features/milestone/extensionPoints.ts": point(MILESTONES),
    "src/features/milestone/milestones/a.other.ts": M,
    "src/features/milestone/milestones/helper.ts": "export function helper() {}\n",
    "src/features/milestone/milestones/empty/readme.md": "x",
    "src/features/milestone/milestones/dup.ts": M,
    "src/features/milestone/milestones/dup/index.ts": M,
    "src/features/milestone/milestones/x.a.b.ts": M,
    "src/features/milestone/milestones/ok.ts": M,
  });
  const plan = planExtensions(root);
  assert.deepEqual(itemsOf(plan, "src/features/milestone", "definitions").map((i) => i.name), ["dup", "ok"]);
  const find = (s) => plan.problems.find((p) => p.includes(s)) ?? "";
  assert.match(find("a.other.ts"), /宣言されていない/);
  assert.match(find("helper.ts"), /export const milestone が無い/);
  assert.match(find("empty"), /index\.ts\(x\)/);
  assert.match(find("/dup.ts"), /同じ名前の項目/);
  assert.match(find("x.a.b.ts"), /名前の形/);
  assert.equal(plan.problems.length, 5, plan.problems.join("\n"));
});

test("fork の宣言: extensionPoints.<fork の名前>.ts の点は同じ持ち主の extensions/ に出る。上流と同名・宣言に無い名前は失敗", () => {
  const root = fixture({
    "src/features/core/user/extensionPoints.ts": point(`  cleanupHandlers: { dir: "cleanup", export: "handler", type: { from: "@/features/user/types", name: "CleanupHandler" }, side: "server" },`),
    "src/features/core/user/extensionPoints.acme.ts": point(
      `  badges: { dir: "badges", export: "badge", type: { from: "@/features/user/types", name: "Badge" }, side: "client" },\n  cleanupHandlers: { dir: "x", export: "y", type: { from: "a", name: "T" }, side: "server" },`,
    ),
    "src/features/core/user/extensionPoints.other.ts": point(`  things: { dir: "t", export: "t", type: { from: "a", name: "T" }, side: "server" },`),
    "src/features/core/user/cleanup/a.ts": "export const handler = 1;\n",
    "src/features/core/user/badges/gold.acme.tsx": "export const badge = 1;\n",
  });
  const plan = planExtensions(root);
  assert.deepEqual(plan.points.map((p) => `${p.name}:${p.forkId}`).sort(), ["badges:acme", "cleanupHandlers:null"]);
  assert.ok(plan.problems.some((p) => p.includes("extensionPoints.acme.ts") && p.includes("cleanupHandlers") && p.includes("でも宣言されている")));
  assert.ok(plan.problems.some((p) => p.includes("extensionPoints.other.ts") && p.includes("宣言されていない")));
  assert.match(plan.outputs["src/features/core/user/extensions/badges.ts"], /import \{ badge as gold_acme \} from "@\/features\/core\/user\/badges\/gold\.acme";/);
});

test("受け口のフォルダが無い点は項目 0 で通る(空の一覧を出す)。alwaysOn は真偽だけ", () => {
  const root = fixture({ "src/features/milestone/extensionPoints.ts": point(MILESTONES) });
  const plan = planExtensions(root);
  assert.deepEqual(plan.problems, []);
  assert.match(plan.outputs["src/features/milestone/extensions/definitions.ts"], /export const definitions: MilestoneDefinition\[\] = \[\];/);
  assert.match(readDeclaration("x/extensionPoints.ts", point(`  a: { dir: "a", export: "a", type: { from: "a", name: "T" }, side: "server", alwaysOn: "yes" },`)).problems[0], /alwaysOn は真偽/);
});

test("描画: literalKeys は鍵の文字列を型に残す。key なし・true 以外は失敗", () => {
  const root = fixture({
    "src/features/core/pairedDevice/extensionPoints.ts": point(`  kinds: { dir: "kinds", export: "kind", type: { from: "@/x", name: "K" }, side: "server", key: "kind", literalKeys: true },`),
    "src/features/core/pairedDevice/kinds/terminal.ts": "export const kind = {};\n",
  });
  const out = planExtensions(root).outputs["src/features/core/pairedDevice/extensions/kinds.ts"];
  assert.match(out, /const kindsList = \[\n  terminal,\n\] as const satisfies readonly K\[\];/);
  assert.match(out, /as unknown as \{ readonly \[I in \(typeof kindsList\)\[number\] as I\["kind"\]\]: I \};/);
  assert.match(out, /kind が重複/);
  const bad = (body) => readDeclaration("x/extensionPoints.ts", point(body)).problems[0];
  assert.match(bad(`  a: { dir: "a", export: "a", type: { from: "a", name: "T" }, side: "server", literalKeys: true },`), /literalKeys は key と一緒に/);
});

test("描画: key の Record・lazy の import・lib の target wiring は src/wiring/<lib>.ts に 1 本", () => {
  const root = fixture({
    "src/features/core/userLineProfile/extensionPoints.ts": point(
      `  webhookHandlers: { dir: "webhooks", export: "webhookHandler", type: { from: "@/features/userLineProfile/types", name: "LineWebhookHandler" }, side: "server", key: "eventType" },`,
    ),
    "src/features/core/userLineProfile/webhooks/follow.ts": "export const webhookHandler = { eventType: \"follow\" };\n",
    "src/app/_layout/adminCommand/extensionPoints.ts": point(
      `  plugins: { dir: "plugins", export: "plugin", type: { from: "@/app/_layout/adminCommand/types", name: "AdminCommandPlugin" }, side: "client", load: "lazy" },`,
    ),
    "src/app/_layout/adminCommand/plugins/search/index.tsx": "export const plugin = {};\n",
    "src/lib/dbAgent/extensionPoints.ts": point(
      `  tools: { dir: "tools", export: "tool", type: { from: "@/lib/dbAgent/types", name: "DbAgentTool" }, side: "server", target: "wiring" },\n  prompts: { dir: "prompts", export: "prompt", type: { from: "@/lib/dbAgent/types", name: "DbAgentPrompt" }, side: "server", target: "wiring" },`,
    ),
    "src/lib/dbAgent/tools/query.ts": "export const tool = {};\n",
    "src/lib/dbAgent/prompts/base.ts": "export const prompt = {};\n",
  });
  const plan = planExtensions(root);
  assert.deepEqual(plan.problems, []);
  const keyed = plan.outputs["src/features/core/userLineProfile/extensions/webhookHandlers.ts"];
  assert.match(keyed, /const webhookHandlersList: LineWebhookHandler\[\] = \[\n  follow,\n\];/);
  assert.match(keyed, /export const webhookHandlers: Readonly<Record<string, LineWebhookHandler>> = Object\.assign\(Object\.create\(null\), Object\.fromEntries\(webhookHandlersList\.map\(\(item\) => \[String\(item\.eventType\), item\]\)\)\);/);
  const lazy = plan.outputs["src/app/_layout/adminCommand/extensions/plugins.ts"];
  assert.match(lazy, /\{ name: "search", load: \(\) => import\("@\/app\/_layout\/adminCommand\/plugins\/search"\)\.then\(\(m\) => m\.plugin\) \},/);
  assert.doesNotMatch(lazy, /^import \{ plugin/m);
  const wiring = plan.outputs["src/wiring/dbAgent.ts"];
  assert.ok(wiring.startsWith(`${headerFor("src/lib/dbAgent/extensionPoints.ts")}\n`));
  assert.match(wiring, /import type \{ DbAgentPrompt, DbAgentTool \} from "@\/lib\/dbAgent\/types";/);
  assert.match(wiring, /export const tools: DbAgentTool\[\] = \[\n  query,\n\];/);
  assert.match(wiring, /export const prompts: DbAgentPrompt\[\] = \[\n  base,\n\];/);
  assert.equal(Object.keys(plan.outputs).length, 3);
});

test("check: 一覧のずれ・extensions/ に手で置いたファイル(受け口を示す)・宣言の消えた古い一覧", () => {
  const root = fixture({
    "src/features/milestone/extensionPoints.ts": point(MILESTONES),
    "src/features/milestone/milestones/a.ts": "export const milestone = 1;\n",
    "src/features/milestone/extensions/handMade.ts": "export const x = 1;\n",
    "src/features/milestone/extensions/old.ts": `${headerFor("src/features/milestone/extensionPoints.ts")}\nexport const old = [];\n`,
    "src/features/other/extensions/x.ts": "export const x = 1;\n",
  });
  const plan = planExtensions(root);
  assert.deepEqual(staleOutputs(root, plan.outputs), ["src/features/milestone/extensions/definitions.ts"]);
  for (const [path, content] of Object.entries(plan.outputs)) writeFileSync(join(root, path), content);
  assert.deepEqual(staleOutputs(root, plan.outputs), []);
  const strays = strayExtensionFiles(root, plan.outputs, plan.points);
  assert.deepEqual(
    strays.map((s) => `${s.path}:${s.generated}:${s.hint}`),
    [
      "src/features/milestone/extensions/handMade.ts:false:受け口は src/features/milestone/milestones",
      "src/features/milestone/extensions/old.ts:true:受け口は src/features/milestone/milestones",
      "src/features/other/extensions/x.ts:false:src/features/other に拡張点の宣言(extensionPoints.ts)が無い",
    ],
  );
  assert.ok(existsSync(join(root, "src/features/milestone/extensions/definitions.ts")));
});

test("1 行スイッチ: .default の隣の素の名前は re-export 1 文だけ、宣言済みの fork の名前・実在する先、Tier1 は .default", () => {
  const D = "export function enrich() {}\n";
  const root = fixture({
    "src/features/core/payment/enricher.default.ts": D,
    "src/features/core/payment/enricher.ts": '// 採用者所有のスイッチ\nexport { enrich } from "./enricher.default";\n',
    "src/features/core/payment/enricher.acme.ts": D,
    "src/features/core/a/x.default.ts": D,
    "src/features/core/a/x.ts": 'export * from "./x.acme";\n',
    "src/features/core/a/x.acme.ts": D,
    "src/features/core/b/y.default.tsx": D,
    "src/features/core/b/y.tsx": 'export { default } from "./y.default";\nexport const z = 1;\n',
    "src/features/core/c/z.default.ts": D,
    "src/features/core/c/z.ts": 'export * from "./z.other";\n',
    "src/features/core/d/w.default.ts": D,
    "src/features/core/d/w.ts": 'export * from "./w.parent";\n',
    "src/features/core/e/v.default.ts": D,
    "src/features/core/f/u.default.ts": D,
    "src/features/core/f/u.ts": 'export * from "../g/u";\n',
    "src/features/core/h/only.acme.ts": D,
  });
  const forkIds = ["acme", "parent"];
  const fork = checkSwitches(root, { forkIds, isTier1: false });
  assert.deepEqual(fork.switches.map((s) => `${s.path}>${s.target}`), ["src/features/core/a/x.ts>x.acme", "src/features/core/payment/enricher.ts>enricher.default"]);
  const reason = (r, s) => r.problems.find((p) => p.includes(s)) ?? "";
  assert.match(reason(fork, "b/y.tsx"), /re-export 1 文だけ/);
  assert.match(reason(fork, "c/z.ts"), /宣言されていない/);
  assert.match(reason(fork, "d/w.ts"), /w\.parent\.ts\(x\) が無い/);
  assert.match(reason(fork, "e/v.default.ts"), /スイッチ v\.ts\(x\) が無い/);
  assert.match(reason(fork, "f/u.ts"), /re-export 1 文だけ/);
  assert.equal(fork.problems.length, 5, fork.problems.join("\n"));

  const tier1 = checkSwitches(root, { forkIds, isTier1: true });
  assert.match(reason(tier1, "a/x.ts"), /上流\(Tier1\)のスイッチは x\.default を指す/);
  assert.deepEqual(tier1.switches.map((s) => s.path), ["src/features/core/payment/enricher.ts"]);
});

test("override: 上流(Tier1)は 1 本も出荷しない(空も)。fork は空も中身ありも通る。素の override.ts は cron のタスクだけ", () => {
  const root = fixture({
    "src/app/api/cron/wallet-expire/override.ts": "export const cronOverride = { disabled: true };\n",
    "src/app/api/cron/other/override.ts": "// 親の上書きを外す\n",
    "src/features/core/user/services/server/domainEntry.override.ts": "export const domainEntryOverrides = {};\n",
    "src/features/core/x/thing.override.tsx": "export const x = 1;\n",
    "src/features/core/x/override.ts": "export const notAnOverride = 1;\n",
  });
  const fork = checkOverrides(root, { isTier1: false });
  assert.deepEqual(fork.problems, []);
  assert.deepEqual(
    fork.overrides.map((o) => `${o.path}:${o.blank}`),
    [
      "src/app/api/cron/other/override.ts:true",
      "src/app/api/cron/wallet-expire/override.ts:false",
      "src/features/core/user/services/server/domainEntry.override.ts:false",
      "src/features/core/x/thing.override.tsx:false",
    ],
  );
  const tier1 = checkOverrides(root, { isTier1: true });
  assert.equal(tier1.problems.length, 4, tier1.problems.join("\n"));
  assert.ok(tier1.problems.every((p) => p.includes("上流(Tier1)は override を出荷しない")));
});

test("実リポ: 宣言・項目の問題が無く、生成一覧が一致し、extensions/ に手で置いたファイルが無い(ずれたら pnpm extensions:generate)", () => {
  const plan = planExtensions(repoRoot);
  assert.deepEqual(plan.problems, [], plan.problems.join("\n"));
  assert.deepEqual(staleOutputs(repoRoot, plan.outputs), []);
  assert.deepEqual(strayExtensionFiles(repoRoot, plan.outputs, plan.points), []);
  assert.deepEqual(plan.overrides, [], "上流は override を出荷しない");
});

test("files の点: 1 段下の決まった名前のファイルが項目、folder が付く、印が無ければ失敗", () => {
  const root = mkdtempSync(join(tmpdir(), "ext-files-"));
  const put = (path, text) => {
    mkdirSync(dirname(join(root, path)), { recursive: true });
    writeFileSync(join(root, path), text);
  };
  try {
    put(".claude/rules/project.md", "fork_id: next-starter\n");
    put("src/lib/CATALOG.md", "## next-starter\n");
    put("src/app/demo/extensionPoints.ts", 'export const extensionPoints = { pages: { dir: ".", files: "*/_demo.ts", export: "demo", type: { from: "@/t", name: "T" }, side: "shared" } };\n');
    put("src/app/demo/b-page/_demo.ts", "export const demo = {};\n");
    put("src/app/demo/a-page/_demo.ts", "export const demo = {};\n");
    put("src/app/demo/no-entry/page.tsx", "");
    let plan = planExtensions(root);
    assert.deepEqual(plan.problems, []);
    const out = plan.outputs["src/app/demo/extensions/pages.ts"];
    assert.match(out, /import \{ demo as a_page \} from "@\/app\/demo\/a-page\/_demo";/);
    assert.match(out, /\{ \.\.\.a_page, folder: "a-page" \},\n {2}\{ \.\.\.b_page, folder: "b-page" \}/);
    put("src/app/demo/b-page/_demo.ts", "export const other = {};\n");
    plan = planExtensions(root);
    assert.ok(plan.problems.some((p) => p.includes("export const demo が無い")));
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("key の一覧: constructor・__proto__ で引いても何も当たらず、その名前の項目は引ける", async () => {
  const root = mkdtempSync(join(tmpdir(), "ext-proto-"));
  const put = (path, text) => {
    mkdirSync(dirname(join(root, path)), { recursive: true });
    writeFileSync(join(root, path), text);
  };
  try {
    put(".claude/rules/project.md", "fork_id: next-starter\n");
    put("src/lib/CATALOG.md", "## next-starter\n");
    put("src/features/x/extensionPoints.ts", 'export const extensionPoints = { rules: { dir: "rules", export: "rule", type: { from: "@/t", name: "T" }, side: "server", key: "k" } };\n');
    put("src/features/x/rules/a.ts", 'export const rule = { k: "a" };\n');
    const out = planExtensions(root).outputs["src/features/x/extensions/rules.ts"];
    const body = out.slice(out.indexOf("export const rules")).replace(/^export const rules: [^=]*= /, "").split("\n")[0].replace(/;$/, "");
    const rulesList = [{ k: "a" }, { k: "__proto__" }];
    const rules = new Function("rulesList", `return ${body}`)(rulesList);
    assert.equal(rules.constructor, undefined);
    assert.equal(rules.toString, undefined);
    assert.equal(Object.getPrototypeOf(rules), null);
    assert.deepEqual(Object.keys(rules), ["a", "__proto__"]);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
