// scripts/extensions/extensions.test.mjs
// 拡張点の生成器(宣言の読み手 src/lib/forkOwnership/declarations.mjs・./extensions.mjs)の回帰テスト。一時ディレクトリの fixture で動かす。
// - 宣言はリテラルだけ(式・未知のキー・点の名前の形は失敗)、src の下ならどこでも読む(lib の target: "wiring" も)
// - 項目はファイル(<名前>.ts(x))かフォルダ(<名前>/index.ts(x))、名前の順。import の別名 = <点の名前>_<項目の名前>
// - 失敗: 旧い fork の名前の印(移し方を案内) / export が無い / 同じ名前のファイルとフォルダ / 旧い extensionPoints.<x>.ts
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

import { readForkIdentity } from "../../src/lib/forkOwnership/forkIds.mjs";

import { readDeclaration } from "../../src/lib/forkOwnership/declarations.mjs";
import { checkOverrides } from "./overrides.mjs";
import { checkSwitches } from "./switches.mjs";
import { headerFor, itemsOf, planExtensions, staleOutputs, strayExtensionFiles } from "./extensions.mjs";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");

/** fork(acme、祖先 parent)の一時リポにファイルを置く */
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

test("走査: ファイルとフォルダの 2 形・名前の順。src の下のどこでも宣言を読む", () => {
  const M = "export const milestone = { id: 1 };\n";
  const root = fixture({
    "src/features/milestone/extensionPoints.ts": point(MILESTONES),
    "src/features/milestone/milestones/zeta.ts": M,
    "src/features/milestone/milestones/alpha.ts": M,
    "src/features/milestone/milestones/beta/index.tsx": M,
    "src/features/milestone/milestones/beta/part.ts": "export const x = 1;\n",
    "src/features/milestone/milestones/gamma.tsx": M,
    "src/features/milestone/milestones/zeta.test.ts": M,
    "src/features/milestone/milestones/notes.md": "x",
  });
  const plan = planExtensions(root);
  assert.deepEqual(plan.problems, []);
  assert.deepEqual(
    itemsOf(plan, "src/features/milestone", "definitions").map((i) => i.name),
    ["alpha", "beta", "gamma", "zeta"],
  );
  const out = plan.outputs["src/features/milestone/extensions/definitions.ts"];
  assert.ok(out.startsWith(`${headerFor("src/features/milestone/extensionPoints.ts")}\n`));
  assert.match(out, /import type \{ MilestoneDefinition \} from "@\/features\/milestone\/types";/);
  assert.match(out, /import \{ milestone as definitions_alpha \} from "@\/features\/milestone\/milestones\/alpha";/);
  assert.match(out, /import \{ milestone as definitions_beta \} from "@\/features\/milestone\/milestones\/beta";/);
  assert.match(out, /export const definitions: MilestoneDefinition\[\] = \[\n  definitions_alpha,\n  definitions_beta,\n  definitions_gamma,\n  definitions_zeta,\n\];/);
});

test("失敗: 旧い fork の印(移し方を案内)・export が無い・index の無いフォルダ・同じ名前のファイルとフォルダ・名前の形", () => {
  const M = "export const milestone = 1;\n";
  const root = fixture({
    "src/features/milestone/extensionPoints.ts": point(MILESTONES),
    "src/features/milestone/milestones/a.other.ts": M,
    "src/features/milestone/milestones/helper.ts": "export function helper() {}\n",
    "src/features/milestone/milestones/empty/readme.md": "x",
    "src/features/milestone/milestones/dup.ts": M,
    "src/features/milestone/milestones/dup/index.ts": M,
    "src/features/milestone/milestones/x.a.b.ts": M,
    "src/features/milestone/milestones/old.acme/index.ts": M,
    "src/features/milestone/milestones/x.default.ts": M,
    "src/features/milestone/milestones/1bad.ts": M,
    "src/features/milestone/milestones/ok.ts": M,
  });
  const plan = planExtensions(root);
  assert.deepEqual(itemsOf(plan, "src/features/milestone", "definitions").map((i) => i.name), ["dup", "ok"]);
  const find = (s) => plan.problems.find((p) => p.includes(s)) ?? "";
  assert.match(find("a.other.ts"), /印なしの a\.ts に改名/);
  assert.ok(find("a.other.ts").includes("shared-shelf marker migration notice"));
  assert.match(find("x.a.b.ts"), /印なしの x\.ts に改名/);
  assert.match(find("old.acme"), /印なしの old\/ に改名/);
  assert.match(find("x.default.ts"), /名前の形/);
  assert.match(find("1bad.ts"), /名前の形/);
  assert.match(find("helper.ts"), /export const milestone が無い/);
  assert.match(find("empty"), /index\.ts\(x\)/);
  assert.match(find("/dup.ts"), /同じ名前の項目/);
  // x.default.ts はスイッチの検査にも掛かる(隣の素の名前が無い)
  assert.equal(plan.problems.length, 9, plan.problems.join("\n"));
});

test("fork の宣言: fork 自身のフォルダの extensionPoints.ts は上流と同じに読む。旧い extensionPoints.<x>.ts は止めて移し方を案内する", () => {
  const root = fixture({
    "src/features/core/user/extensionPoints.ts": point(`  cleanupHandlers: { dir: "cleanup", export: "handler", type: { from: "@/features/user/types", name: "CleanupHandler" }, side: "server" },`),
    "src/features/core/user/extensionPoints.acme.ts": point(`  badges: { dir: "badges", export: "badge", type: { from: "@/features/user/types", name: "Badge" }, side: "client" },`),
    "src/features/core/user/extensionPoints.test.ts": "export const x = 1;\n",
    "src/features/acmeBadge/extensionPoints.ts": point(`  badges: { dir: "badges", export: "badge", type: { from: "@/features/acmeBadge/types", name: "Badge" }, side: "client" },`),
    "src/features/core/user/cleanup/a.ts": "export const handler = 1;\n",
    "src/features/acmeBadge/badges/gold.tsx": "export const badge = 1;\n",
  });
  const plan = planExtensions(root);
  assert.deepEqual(plan.points.map((p) => `${p.owner}:${p.name}`).sort(), ["src/features/acmeBadge:badges", "src/features/core/user:cleanupHandlers"]);
  assert.equal(plan.problems.length, 1, plan.problems.join("\n"));
  assert.ok(plan.problems[0].includes("extensionPoints.acme.ts") && plan.problems[0].includes("fork 自身のフォルダ") && plan.problems[0].includes("shared-shelf marker migration notice"));
  assert.match(plan.outputs["src/features/acmeBadge/extensions/badges.ts"], /import \{ badge as badges_gold \} from "@\/features\/acmeBadge\/badges\/gold";/);
});

test("受け口の override と .replace: overrideOf の無い点は override を受けない(空は不在)、.replace は項目でなく孤立はスイッチの検査で止まる", () => {
  const M = "export const milestone = 1;\n";
  const plan = planExtensions(
    fixture({
      "src/features/milestone/extensionPoints.ts": point(MILESTONES),
      "src/features/milestone/milestones/a.ts": M,
      "src/features/milestone/milestones/a.override.ts": "export const override = {};\n",
      "src/features/milestone/milestones/b.override.ts": "// 空\n",
      "src/features/milestone/milestones/a.replace.ts": M,
    }),
  );
  assert.deepEqual(itemsOf(plan, "src/features/milestone", "definitions").map((i) => i.name), ["a"]);
  assert.equal(plan.problems.length, 2, plan.problems.join("\n"));
  assert.ok(plan.problems.some((p) => p.includes("a.override.ts") && p.includes("override を受けない")));
  assert.ok(plan.problems.some((p) => p.includes("a.replace.ts") && p.includes("孤立した .replace")));
});

test("受け口の一覧(intake.txt)の生成区画: 受け口のフォルダ(dir \".\"・files の点も)・1 行スイッチの .replace・route の隣・scripts の受け口の add を書き、印の無い一覧は失敗、無い fixture は null", () => {
  const INTAKE = "edit src/config/**  # 値\n# === AUTO-GENERATED intake START ===\nadd old/*.ts  # 古い行\n# === AUTO-GENERATED intake END ===\nappend src/lib/CATALOG.md  # 目録\n";
  const files = {
    "src/features/milestone/extensionPoints.ts": point(MILESTONES),
    "src/proxies/extensionPoints.ts": point(`  handlers: { dir: ".", export: "handler", type: { from: "@/t", name: "H" }, side: "server" },\n  decorators: { dir: ".", export: "decorator", type: { from: "@/t", name: "D" }, side: "server" },`),
    "src/app/demo/extensionPoints.ts": point(`  pages: { dir: ".", files: "*/_demo.ts", export: "demo", type: { from: "@/t", name: "T" }, side: "shared" },`),
    "src/features/core/user/extensionPoints.ts": point(`  roles: { writer: "role:generate", side: "shared" },`),
    "src/features/core/payment/enricher.default.ts": "export function enrich() {}\n",
    "src/features/core/payment/enricher.ts": 'export { enrich } from "./enricher.default";\n',
  };
  assert.equal(planExtensions(fixture(files)).intake, null);
  const plan = planExtensions(fixture({ ...files, "src/lib/forkOwnership/intake.txt": INTAKE }));
  assert.deepEqual(plan.problems, []);
  assert.equal(plan.intake.path, "src/lib/forkOwnership/intake.txt");
  const rows = plan.intake.content.split("\n").filter((l) => /^add /.test(l)).map((l) => l.split("  #")[0]);
  assert.deepEqual(rows, [
    "add src/app/demo/*/_demo.ts",
    "add src/features/milestone/milestones/*.{ts,tsx}",
    "add src/features/milestone/milestones/*/**",
    "add src/proxies/*.{ts,tsx}",
    "add src/proxies/*/**",
    "add src/features/core/payment/enricher.replace.{ts,tsx}",
    "add src/app/**/_layout/**/*.replace.{ts,tsx}",
    "add src/app/**/_screen/**/*.replace.{ts,tsx}",
    "add src/app/**/frame.ts",
    "add scripts/tasks/*.ts",
  ]);
  assert.ok(plan.intake.content.startsWith("edit src/config/**  # 値\n# === AUTO-GENERATED intake START ===\n"));
  assert.ok(plan.intake.content.endsWith("# === AUTO-GENERATED intake END ===\nappend src/lib/CATALOG.md  # 目録\n"), "区画の外は変えない");
  assert.equal(Object.keys(plan.outputs).includes("src/lib/forkOwnership/intake.txt"), false, "一覧の数には入れない");
  const broken = planExtensions(fixture({ ...files, "src/lib/forkOwnership/intake.txt": "edit src/config/**  # 値\n" }));
  assert.ok(broken.problems.some((p) => p.includes("intake.txt") && p.includes("生成区画の印の対")));
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
  assert.match(out, /const kindsList = \[\n  kinds_terminal,\n\] as const satisfies readonly K\[\];/);
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
    // 1 本の wiring に混ざる別の点の同じ名前の項目(別名は点の名前で分かれる)
    "src/lib/dbAgent/prompts/query.ts": "export const prompt = {};\n",
  });
  const plan = planExtensions(root);
  assert.deepEqual(plan.problems, []);
  const keyed = plan.outputs["src/features/core/userLineProfile/extensions/webhookHandlers.ts"];
  assert.match(keyed, /const webhookHandlersList: LineWebhookHandler\[\] = \[\n  webhookHandlers_follow,\n\];/);
  assert.match(keyed, /export const webhookHandlers: Readonly<Record<string, LineWebhookHandler>> = Object\.assign\(Object\.create\(null\), Object\.fromEntries\(webhookHandlersList\.map\(\(item\) => \[String\(item\.eventType\), item\]\)\)\);/);
  const lazy = plan.outputs["src/app/_layout/adminCommand/extensions/plugins.ts"];
  assert.match(lazy, /\{ name: "search", load: \(\) => import\("@\/app\/_layout\/adminCommand\/plugins\/search"\)\.then\(\(m\) => m\.plugin\) \},/);
  assert.doesNotMatch(lazy, /^import \{ plugin/m);
  const wiring = plan.outputs["src/wiring/dbAgent.ts"];
  assert.ok(wiring.startsWith(`${headerFor("src/lib/dbAgent/extensionPoints.ts")}\n`));
  assert.match(wiring, /import type \{ DbAgentPrompt, DbAgentTool \} from "@\/lib\/dbAgent\/types";/);
  assert.match(wiring, /import \{ tool as tools_query \} from "@\/lib\/dbAgent\/tools\/query";/);
  assert.match(wiring, /import \{ prompt as prompts_query \} from "@\/lib\/dbAgent\/prompts\/query";/);
  assert.match(wiring, /export const tools: DbAgentTool\[\] = \[\n  tools_query,\n\];/);
  assert.match(wiring, /export const prompts: DbAgentPrompt\[\] = \[\n  prompts_base,\n  prompts_query,\n\];/);
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

test("1 行スイッチ: .default の隣の素の名前は re-export 1 文だけ、先は .default か .replace(実在する)、旧い印は止める、Tier1 は .default", () => {
  const D = "export function enrich() {}\n";
  const root = fixture({
    "src/features/core/payment/enricher.default.ts": D,
    "src/features/core/payment/enricher.ts": '// 採用者所有のスイッチ\nexport { enrich } from "./enricher.default";\n',
    "src/features/core/payment/enricher.replace.ts": D,
    "src/features/core/a/x.default.ts": D,
    "src/features/core/a/x.ts": 'export * from "./x.replace";\n',
    "src/features/core/a/x.replace.ts": D,
    "src/features/core/b/y.default.tsx": D,
    "src/features/core/b/y.tsx": 'export { default } from "./y.default";\nexport const z = 1;\n',
    "src/features/core/c/z.default.ts": D,
    "src/features/core/c/z.ts": 'export * from "./z.other";\n',
    "src/features/core/d/w.default.ts": D,
    "src/features/core/d/w.ts": 'export * from "./w.replace";\n',
    "src/features/core/e/v.default.ts": D,
    "src/features/core/f/u.default.ts": D,
    "src/features/core/f/u.ts": 'export * from "../g/u";\n',
    "src/features/core/h/only.replace.ts": D,
    "src/app/x/_layout/XLayout.replace.tsx": D,
    "src/features/core/i/t.default.ts": D,
    "src/features/core/i/t.ts": 'export * from "./t.custom.x";\n',
  });
  const fork = checkSwitches(root, { isTier1: false });
  assert.deepEqual(fork.switches.map((s) => `${s.path}>${s.target}`), ["src/features/core/a/x.ts>x.replace", "src/features/core/payment/enricher.ts>enricher.default"]);
  const reason = (r, s) => r.problems.find((p) => p.includes(s)) ?? "";
  assert.match(reason(fork, "b/y.tsx"), /re-export 1 文だけ/);
  assert.match(reason(fork, "c/z.ts"), /印なしの z\.replace\.ts\(x\) に改名/);
  assert.match(reason(fork, "d/w.ts"), /w\.replace\.ts\(x\) が無い/);
  assert.match(reason(fork, "i/t.ts"), /t\.default か t\.replace だけ/);
  assert.match(reason(fork, "e/v.default.ts"), /スイッチ v\.ts\(x\) が無い/);
  assert.match(reason(fork, "f/u.ts"), /re-export 1 文だけ/);
  assert.match(reason(fork, "h/only.replace.ts"), /孤立した \.replace/);
  assert.ok(!fork.problems.some((p) => p.includes("_layout")), "route の隣は test:screens の側");
  assert.equal(fork.problems.length, 7, fork.problems.join("\n"));

  const tier1 = checkSwitches(root, { isTier1: true });
  assert.match(reason(tier1, "a/x.ts"), /上流\(Tier1\)のスイッチは x\.default を指す/);
  assert.deepEqual(tier1.switches.map((s) => s.path), ["src/features/core/payment/enricher.ts"]);
});

test("override: 上流(Tier1)は 1 本も出荷しない(空も)。fork は空も中身ありも通る。素の override.ts は cron のタスクだけ。隣に対象の無い override は孤立で失敗", () => {
  const root = fixture({
    "src/features/core/user/services/server/domainEntry.ts": "export const domainEntry = {};\n",
    "src/features/core/x/thing.tsx": "export const x = 1;\n",
    "src/features/core/user/coreRoles/user.role.json": "{}\n",
    "src/features/core/userProfile/profiles/user.profile.json": "{}\n",
    "src/app/api/cron/wallet-expire/override.ts": "export const cronOverride = { disabled: true };\n",
    "src/app/api/cron/other/override.ts": "// 親の上書きを外す\n",
    "src/features/core/user/services/server/domainEntry.override.ts": "export const domainEntryOverrides = {};\n",
    "src/features/core/x/thing.override.tsx": "export const x = 1;\n",
    "src/features/core/user/coreRoles/user.role.override.ts": "export const override = {};\n",
    "src/features/core/userProfile/profiles/user.profile.override.ts": "export const override = {};\n",
    "src/features/core/x/override.ts": "export const notAnOverride = 1;\n",
  });
  const fork = checkOverrides(root, { isTier1: false });
  assert.deepEqual(fork.problems, []);
  assert.deepEqual(
    fork.overrides.map((o) => `${o.path}:${o.blank}`),
    [
      "src/app/api/cron/other/override.ts:true",
      "src/app/api/cron/wallet-expire/override.ts:false",
      "src/features/core/user/coreRoles/user.role.override.ts:false",
      "src/features/core/user/services/server/domainEntry.override.ts:false",
      "src/features/core/userProfile/profiles/user.profile.override.ts:false",
      "src/features/core/x/thing.override.tsx:false",
    ],
  );
  const tier1 = checkOverrides(root, { isTier1: true });
  assert.equal(tier1.problems.length, 6, tier1.problems.join("\n"));
  const orphan = fixture({
    "src/features/core/x/gone.override.ts": "export const x = 1;\n",
    "src/features/core/x/blank.override.ts": "// 親の上書きを外す\n",
    "src/features/core/x/folder.override.ts": "export const x = 1;\n",
    "src/features/core/x/folder/index.ts": "export const x = 1;\n",
    "src/features/core/setting/fields/n.override.ts": "export const override = {};\n",
  });
  const lone = checkOverrides(orphan, { isTier1: false, receptacleDirs: ["src/features/core/setting/fields"] });
  assert.deepEqual(lone.problems.map((p) => p.split(":")[0]), ["src/features/core/x/gone.override.ts"], "空は不在と同じ、フォルダの対象は可、受け口の中は extensions.mjs の側");
  assert.match(lone.problems[0], /孤立した override/);
  assert.ok(tier1.problems.every((p) => p.includes("上流(Tier1)は override を出荷しない")));
});

test("実リポ: 宣言・項目の問題が無く、生成一覧が一致し、extensions/ に手で置いたファイルが無い(ずれたら pnpm extensions:generate)", () => {
  const plan = planExtensions(repoRoot);
  assert.deepEqual(plan.problems, [], plan.problems.join("\n"));
  assert.deepEqual(staleOutputs(repoRoot, plan.outputs), []);
  assert.deepEqual(strayExtensionFiles(repoRoot, plan.outputs, plan.points), []);
  // override は足した Tier の物(fork の cron の override.ts は受け口)。上流だけ 0 を見る
  if (readForkIdentity(repoRoot).isTier1) assert.deepEqual(plan.overrides, [], "上流は override を出荷しない");
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
    assert.match(out, /import \{ demo as pages_a_page \} from "@\/app\/demo\/a-page\/_demo";/);
    assert.match(out, /\{ \.\.\.pages_a_page, folder: "a-page" \},\n {2}\{ \.\.\.pages_b_page, folder: "b-page" \}/);
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

const SETTING_POINTS = point(`  fields: { dir: "fields", export: "field", type: { from: "@/t", name: "F" }, side: "shared", shape: "object", pureImports: true, requireText: ".default(", overrideOf: ["ui", "public"], derive: "settingSections" },
  sections: { dir: "sections", export: "section", type: { from: "@/t", name: "S" }, side: "client", key: "key", overrideOf: ["label"] },`);
const KEY = 'import { z } from "zod";\nexport const field = { schema: z.number().default(1), ui: { section: "general" } };\n';
const SECTION = 'export const section = { key: "general", label: "x", order: 1 };\n';
const settingPlan = (extra) =>
  planExtensions(fixture({
    "tsconfig.json": JSON.stringify({ compilerOptions: { baseUrl: ".", paths: { "@/*": ["./src/*"] } } }),
    "src/features/core/setting/extensionPoints.ts": SETTING_POINTS,
    "src/features/core/setting/sections/general.ts": SECTION,
    "src/features/core/setting/fields/a.ts": KEY,
    ...extra,
  }));
const hasProblem = (plan, text) => assert.ok(plan.problems.some((p) => p.includes(text)), `${text} が無い: ${plan.problems.join(" / ")}`);

test("setting の点: shape object はキーを型に残し、足したキーも並び、null プロトタイプ", () => {
  const plan = settingPlan({ "src/features/core/setting/fields/b.ts": KEY });
  assert.deepEqual(plan.problems, []);
  const out = plan.outputs["src/features/core/setting/extensions/fields.ts"];
  assert.match(out, /const fieldsMap = \{\n {2}a: fields_a,\n {2}b: fields_b,\n\} as const satisfies Readonly<Record<string, F>>;/);
  assert.match(out, /export const fields = Object\.assign\(Object\.create\(null\), fieldsMap\) as typeof fieldsMap;/);
});

test("setting の点: 失敗の形(.default なし・同名・無いセクション・セクションの重複)", () => {
  hasProblem(settingPlan({ "src/features/core/setting/fields/n.ts": 'export const field = { schema: 1 };\n' }), ".default( が無い");
  hasProblem(settingPlan({ "src/features/core/setting/fields/a.acme.ts": KEY }), "印なしの a.ts に改名");
  hasProblem(settingPlan({ "src/features/core/setting/fields/a/index.ts": KEY }), "同じ名前の項目");
  hasProblem(settingPlan({ "src/features/core/setting/fields/x.ts": KEY.replace("general", "nope") }), '無いセクション "nope"');
  hasProblem(settingPlan({ "src/features/core/setting/sections/other.ts": SECTION }), 'セクションの key "general"');
});

test("setting の点: キーから推移的に届く値 import を止める、型だけと config と純関数は通す", () => {
  const f = "src/features/core/setting/fields/";
  const key = (imp) => `${imp}\nexport const field = { schema: z.number().default(1) };\n`;
  hasProblem(settingPlan({ [`${f}r.ts`]: key('import React from "react";') }), "react");
  hasProblem(settingPlan({ [`${f}s.ts`]: key('import "server-only";') }), "server-only");
  hasProblem(settingPlan({ [`${f}d.ts`]: key('import { x } from "@/features/foo/services/server/x";'), "src/features/foo/services/server/x.ts": "export const x = 1;\n" }), "services/server/x.ts");
  const deep = settingPlan({
    [`${f}t.ts`]: key('import { y } from "@/config/app/y";'),
    "src/config/app/y.ts": 'import { w } from "@/utils/w";\nexport const y = w;\n',
    "src/utils/w.ts": 'import "server-only";\nexport const w = 1;\n',
  });
  hasProblem(deep, "server-only");
  const fine = settingPlan({
    [`${f}o.ts`]: key('import type { T } from "@/features/foo/services/server/t";\nimport { y } from "@/config/app/y";'),
    "src/config/app/y.ts": "export const y = 1;\n",
  });
  assert.deepEqual(fine.problems, []);
});

test("setting の点: override は許す属性だけ、既存の項目だけ、一覧に重なる、空は不在", () => {
  const f = "src/features/core/setting/fields/";
  const ok = settingPlan({ [`${f}a.override.ts`]: 'export const override = { public: true };\n' });
  assert.deepEqual(ok.problems, []);
  assert.match(ok.outputs["src/features/core/setting/extensions/fields.ts"], /a: \{ \.\.\.fields_a, \.\.\.fields_a_override \},/);
  hasProblem(settingPlan({ [`${f}a.override.ts`]: 'export const override = { schema: 1 };\n' }), "schema は上書きできない");
  hasProblem(settingPlan({ [`${f}nope.override.ts`]: 'export const override = { public: true };\n' }), "項目 nope が無い");
  // 「上流の項目だけ」は名前では見分けない(所有の側の検査、指令 02)。足した項目への override もここでは通る
  assert.deepEqual(settingPlan({ [`${f}b.ts`]: KEY, [`${f}b.override.ts`]: 'export const override = { public: true };\n' }).problems, []);
  const blank = settingPlan({ [`${f}a.override.ts`]: "// 空\n" });
  assert.deepEqual(blank.problems, []);
  assert.doesNotMatch(blank.outputs["src/features/core/setting/extensions/fields.ts"], /fields_a_override/);
  const sec = settingPlan({ "src/features/core/setting/sections/general.override.ts": 'export const override = { label: "y" };\n' });
  assert.deepEqual(sec.problems, []);
  assert.match(sec.outputs["src/features/core/setting/extensions/sections.ts"], /\{ \.\.\.sections_general, \.\.\.sections_general_override \},/);
});

test("writer の点: 別の生成器が書く一覧。持てるのは side だけ、ほかのキー・未知の writer は失敗", () => {
  const read = (body) => readDeclaration("x/extensionPoints.ts", `export const extensionPoints = { roles: ${body} };`);
  assert.deepEqual(read('{ writer: "role:generate", side: "shared" }').problems, []);
  assert.equal(read('{ writer: "other", side: "shared" }').problems.length, 1);
  assert.equal(read('{ writer: "role:generate", side: "shared", dir: "roles" }').problems.length, 1);
});
