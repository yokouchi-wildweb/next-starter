// scripts/structure/extensions/extensions.test.mjs
// 拡張点の生成器(宣言の読み手 src/lib/districtMap/declarations.mjs・./extensions.mjs)の回帰テスト。一時ディレクトリの fixture で動かす。
// - 宣言はリテラルだけ(式・未知のキー・点の名前の形は失敗)、src の下ならどこでも読む(lib の target: "wiring" も)
// - 項目はファイル(<名前>.ts(x))かフォルダ(<名前>/index.ts(x))、名前の順。import の別名 = <点の名前>_<項目の名前>
// - 失敗: 旧い fork の名前の印(移し方を案内) / export が無い / 同じ名前のファイルとフォルダ / 旧い extensionPoints.<x>.ts
// - 描画: eager の配列・key の Record・lazy の import・wiring の 1 本・共通のヘッダ
// - check: ずれ・extensions/ の手で置いたファイル(ヘッダ無し)・宣言の消えた古い一覧
// - 1 行スイッチ(./switches.mjs)の形と、上流は override を出荷しない(./overrides.mjs)
// - 門番の規則の dependsOn(./derive/gateDependsOn.mjs): 字面を一覧に写し、非リテラル・自分・重複・未知の名前・輪(推移的)を名前を出して止める
// 実行: pnpm test scripts/structure/extensions/extensions.test.mjs

import assert from "node:assert/strict";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

import { readForkIdentity } from "../../../src/lib/forkOwnership/forkIds.mjs";

import { readDeclaration } from "../../../src/lib/districtMap/declarations.mjs";
import { checkDependsOnGraph, readDependsOn } from "./derive/gateDependsOn.mjs";
import { checkOverrides } from "./overrides.mjs";
import { CLAIMERS, checkSwitches, isClaimedDefault } from "./switches.mjs";
import { intakeRows } from "./intake.mjs";
import { headerFor, itemsOf, planExtensions, staleOutputs, strayExtensionFiles } from "./extensions.mjs";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");

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
  assert.ok(plan.intake.content.includes("\nedit src/features/core/payment/enricher.ts  # 1 行スイッチ"), "1 行スイッチの素の名前は edit の行");
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

test("1 行スイッチ: src/app の frame.default.ts は枠の宣言の既定でスイッチではない(隣の frame.ts も不在も問わない)", () => {
  const root = fixture({
    "src/app/(user)/a/page.tsx": "export default 1;\n",
    "src/app/(user)/a/frame.default.ts": "export const frameDefault = { page: {} };\n",
    "src/app/(user)/b/page.tsx": "export default 1;\n",
    "src/app/(user)/b/frame.default.ts": "export const frameDefault = { page: {} };\n",
    "src/app/(user)/b/frame.ts": "export const frame = { page: { fill: true } };\n",
    "src/features/core/x/frame.default.ts": "export const x = 1;\n",
  });
  try {
    for (const isTier1 of [true, false]) {
      const { switches, problems } = checkSwitches(root, { isTier1 });
      assert.deepEqual(switches, []);
      assert.deepEqual(problems, ["src/features/core/x/frame.default.ts: 隣にスイッチ frame.ts(x) が無い(呼び手が import する素の名前。中身は export … from \"./frame.default\" の 1 行)"], "src/app の外の frame.default は今どおりスイッチの既定");
    }
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("1 行スイッチ: .default を使うほかの仕組みは形を名乗れば外れる(name でも pattern でも)、名乗りの無い .default は今どおりスイッチの既定", () => {
  const root = fixture({
    "src/features/core/theme/palette.default.ts": "export const palette = {};\n",
    "src/features/core/theme/tokens/accent.default.ts": "export const accent = 1;\n",
    "src/features/core/other/x.default.ts": "export const x = 1;\n",
  });
  try {
    const claims = [...CLAIMERS, { by: "test(名前で)", under: "src/features/core/theme", name: "palette.default.ts" }, { by: "test(形で)", under: "src/features/core/theme/tokens", pattern: /^[a-z]+\.default\.ts$/ }];
    const { problems } = checkSwitches(root, { isTier1: true, claims });
    assert.deepEqual(problems, ["src/features/core/other/x.default.ts: 隣にスイッチ x.ts(x) が無い(呼び手が import する素の名前。中身は export … from \"./x.default\" の 1 行)"]);
    assert.equal(checkSwitches(root, { isTier1: true }).problems.length, 3, "名乗りが無ければ全部スイッチの既定");
    assert.equal(isClaimedDefault("src/app/(user)/frame.default.ts"), true, "枠の仕組み(frames.mjs)の名乗り");
    assert.equal(isClaimedDefault("src/features/core/x/frame.default.ts"), false);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("1 行スイッチ: route の _layout の隣の既定(管理のヘッダー AdminHeader.default.tsx)もスイッチとして数え、Tier1 は .default、fork は .replace を指せる", () => {
  const D = "export function AdminHeader() { return null; }\n";
  const files = (target) => ({
    "src/app/admin/_layout/AdminHeader.default.tsx": D,
    "src/app/admin/_layout/AdminHeader.tsx": `export { AdminHeader } from "./AdminHeader.${target}";\n`,
    ...(target === "replace" ? { "src/app/admin/_layout/AdminHeader.replace.tsx": D } : {}),
  });
  const upstream = fixture(files("default"));
  const fork = fixture(files("replace"));
  try {
    const tier1 = checkSwitches(upstream, { isTier1: true });
    assert.deepEqual(tier1.problems, []);
    assert.deepEqual(tier1.switches.map((sw) => sw.path), ["src/app/admin/_layout/AdminHeader.tsx"]);
    assert.ok(intakeRows([], tier1.switches).includes("add src/app/admin/_layout/AdminHeader.replace.{ts,tsx}  # 1 行スイッチ src/app/admin/_layout/AdminHeader.tsx の丸ごと置き換え"));
    assert.deepEqual(checkSwitches(fork, { isTier1: false }).problems, []);
    assert.match(checkSwitches(fork, { isTier1: true }).problems.join(), /AdminHeader\.tsx/, "上流のスイッチは .default を指す");
  } finally {
    rmSync(upstream, { recursive: true, force: true });
    rmSync(fork, { recursive: true, force: true });
  }
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
  assert.ok(!fork.problems.some((p) => p.includes("only.replace") || p.includes("_layout")), "孤立した .replace は孤立の検査 orphans.mjs の側");
  assert.equal(fork.problems.length, 6, fork.problems.join("\n"));

  const tier1 = checkSwitches(root, { isTier1: true });
  assert.match(reason(tier1, "a/x.ts"), /上流\(Tier1\)のスイッチは x\.default を指す/);
  assert.deepEqual(tier1.switches.map((s) => s.path), ["src/features/core/payment/enricher.ts"]);
});

test("override: 上流(Tier1)は 1 本も出荷しない(空も)。fork は空も中身ありも通る。cron は task.ts の隣の task.override.ts。素の override.ts は override ではない(孤立は orphans.mjs)", () => {
  const root = fixture({
    "src/features/core/user/services/server/domainEntry.ts": "export const domainEntry = {};\n",
    "src/features/core/x/thing.tsx": "export const x = 1;\n",
    "src/features/core/user/coreRoles/user.role.json": "{}\n",
    "src/features/core/userProfile/profiles/user.profile.json": "{}\n",
    "src/app/api/cron/wallet-expire/task.ts": "export const cronTask = {};\n",
    "src/app/api/cron/wallet-expire/task.override.ts": "export const cronOverride = { disabled: true };\n",
    "src/app/api/cron/other/task.override.ts": "// 親の上書きを外す\n",
    "src/app/api/cron/legacy/override.ts": "export const cronOverride = { disabled: true };\n",
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
      "src/app/api/cron/other/task.override.ts:true",
      "src/app/api/cron/wallet-expire/task.override.ts:false",
      "src/features/core/user/coreRoles/user.role.override.ts:false",
      "src/features/core/user/services/server/domainEntry.override.ts:false",
      "src/features/core/userProfile/profiles/user.profile.override.ts:false",
      "src/features/core/x/thing.override.tsx:false",
    ],
  );
  const tier1 = checkOverrides(root, { isTier1: true });
  assert.equal(tier1.problems.length, 6, tier1.problems.join("\n"));
  assert.ok(tier1.problems.every((p) => p.includes("上流(Tier1)は override を出荷しない")));
});

test("実リポ: 宣言・項目の問題が無く、生成一覧が一致し、extensions/ に手で置いたファイルが無い(ずれたら pnpm generate extensions)", () => {
  const plan = planExtensions(repoRoot);
  assert.deepEqual(plan.problems, [], plan.problems.join("\n"));
  assert.deepEqual(staleOutputs(repoRoot, plan.outputs), []);
  assert.deepEqual(strayExtensionFiles(repoRoot, plan.outputs, plan.points), []);
  // override は足した Tier の物(fork の cron の task.override.ts は受け口)。上流だけ 0 を見る
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

// setting の上書きは権限を絞るだけ(derive/settingRoles.mjs)。上流 = 項目のファイル、上書き = 隣の .override.ts
const ROLE_POINTS = point(`  fields: { dir: "fields", export: "field", type: { from: "@/t", name: "F" }, side: "shared", shape: "object", pureImports: true, requireText: ".default(", overrideOf: ["ui", "public", "default", "allowRoles"], derive: "settingSections" },
  sections: { dir: "sections", export: "section", type: { from: "@/t", name: "S" }, side: "client", key: "key", overrideOf: ["label", "order", "icon", "allowRoles", "description", "groups"] },`);
const roleField = (props) => `import { z } from "zod";\nexport const field = { schema: z.number().default(1), ${props} };\n`;
const roleSection = (key, props = "") => `export const section = { key: "${key}", label: "x", order: 1${props ? `, ${props}` : ""} };\n`;
const S = "src/features/core/setting/sections/";
const F = "src/features/core/setting/fields/";
const rolePlan = (files) =>
  planExtensions(fixture({
    "tsconfig.json": JSON.stringify({ compilerOptions: { baseUrl: ".", paths: { "@/*": ["./src/*"] } } }),
    "src/features/core/setting/extensionPoints.ts": ROLE_POINTS,
    [`${S}locked.ts`]: roleSection("locked", 'allowRoles: ["admin"]'),
    [`${S}open.ts`]: roleSection("open"),
    [`${F}keyRoles.ts`]: roleField('allowRoles: ["admin", "editor"], ui: { section: "open" }'),
    [`${F}inLocked.ts`]: roleField('ui: { section: "locked" }'),
    [`${F}free.ts`]: roleField('ui: { section: "open" }'),
    ...files,
  }));
const widened = (plan, file) => assert.ok(plan.problems.some((p) => p.startsWith(file) && p.includes("広げている")), `${file} の「広げている」が無い: ${plan.problems.join(" / ")}`);

test("setting の上書きの権限: 広げる上書きは (a)〜(d) どれも止める", () => {
  // (a) キーの allowRoles に上流の外のロール・空
  widened(rolePlan({ [`${F}keyRoles.override.ts`]: 'export const override = { allowRoles: ["admin", "viewer"] };\n' }), `${F}keyRoles.override.ts`);
  widened(rolePlan({ [`${F}keyRoles.override.ts`]: "export const override = { allowRoles: [] };\n" }), `${F}keyRoles.override.ts`);
  // (a) キーに絞りが無くセクションに絞りがある: セクションの外のロール
  widened(rolePlan({ [`${F}inLocked.override.ts`]: 'export const override = { allowRoles: ["admin", "editor"] };\n' }), `${F}inLocked.override.ts`);
  // (b) セクションの上書きで広げる
  widened(rolePlan({ [`${S}locked.override.ts`]: 'export const override = { allowRoles: ["admin", "editor"] };\n' }), `${S}locked.override.ts`);
  widened(rolePlan({ [`${S}locked.override.ts`]: "export const override = { allowRoles: undefined };\n" }), `${S}locked.override.ts`);
  // (c) 絞りの無いセクションへ移して広げる
  widened(rolePlan({ [`${F}inLocked.override.ts`]: 'export const override = { ui: { section: "open", field: { label: "x" } } };\n' }), `${F}inLocked.override.ts`);
  // (c) ui を外して所属を無くす = 絞りが消える
  widened(rolePlan({ [`${F}inLocked.override.ts`]: "export const override = { ui: undefined };\n" }), `${F}inLocked.override.ts`);
  // (d) 絞りを書かないことで外す(allowRoles: undefined → 絞りの無いセクションの権限になる)
  widened(rolePlan({ [`${F}keyRoles.override.ts`]: "export const override = { allowRoles: undefined };\n" }), `${F}keyRoles.override.ts`);
});

test("setting の上書きの権限: 絞る・権限に触れない・上流の項目だけは通る、読めない書き方は止める", () => {
  assert.deepEqual(rolePlan({}).problems, []);
  // 絞る(部分集合)
  assert.deepEqual(rolePlan({ [`${F}keyRoles.override.ts`]: 'export const override = { allowRoles: ["admin"] };\n' }).problems, []);
  assert.deepEqual(rolePlan({ [`${S}locked.override.ts`]: 'export const override = { allowRoles: ["admin"] };\n' }).problems, []);
  // allowRoles を書かない上書きは上流の絞りのまま(キーの絞りがセクションより優先: 移しても広がらない)
  assert.deepEqual(rolePlan({ [`${F}keyRoles.override.ts`]: 'export const override = { public: true, ui: { section: "locked", field: { label: "x" } } };\n' }).problems, []);
  assert.deepEqual(rolePlan({ [`${F}inLocked.override.ts`]: "export const override = { public: true };\n" }).problems, []);
  // 絞りの無いキーは何をしても広がらない / 絞りのあるセクションへ移すのは絞る側
  assert.deepEqual(rolePlan({ [`${F}free.override.ts`]: 'export const override = { allowRoles: ["viewer"] };\n' }).problems, []);
  assert.deepEqual(rolePlan({ [`${F}free.override.ts`]: 'export const override = { ui: { section: "locked", field: { label: "x" } } };\n' }).problems, []);
  // セクションの label などは見ない
  assert.deepEqual(rolePlan({ [`${S}locked.override.ts`]: 'export const override = { label: "y", groups: [] };\n' }).problems, []);
  // 上流に絞りがある所で読めない書き方 = 確かめられないので止める
  const roles = rolePlan({ [`${F}keyRoles.override.ts`]: "const r = [\"admin\"];\nexport const override = { allowRoles: r };\n" });
  assert.ok(roles.problems.some((p) => p.includes("確かめられない")), roles.problems.join(" / "));
});

test("fork の今の受け口の override(oripa-do の 8 本: 管理メニューのカテゴリー 3・項目 4・設定のセクション 1)が実リポの宣言で通る(鍵の集合は変えない)", () => {
  const declaration = (path) => readFileSync(join(repoRoot, path), "utf8");
  const item = (exportName, key) => `export const ${exportName} = { key: "${key}" };\n`;
  const files = {
    "src/features/core/admin/extensionPoints.ts": declaration("src/features/core/admin/extensionPoints.ts"),
    "src/features/core/setting/extensionPoints.ts": declaration("src/features/core/setting/extensionPoints.ts"),
    "src/features/core/setting/sections/maintenance.ts": item("section", "maintenance"),
    "src/features/core/setting/sections/maintenance.override.ts": 'import type { SettingSectionOverride } from "../types/definition";\n\nexport const override: SettingSectionOverride = { order: 30 };\n',
  };
  const categories = { users: '{ allowRoles: ["admin"] }', system: '{ label: "システム設定" }', data: "{ hidden: true }" };
  for (const [name, body] of Object.entries(categories)) {
    files[`src/features/core/admin/menu/categories/${name}.ts`] = item("category", name);
    files[`src/features/core/admin/menu/categories/${name}.override.ts`] = `import type { AdminMenuCategoryOverride } from "../types";\n\nexport const override = ${body} satisfies AdminMenuCategoryOverride;\n`;
  }
  const items = { usersGeneral: ["User", "{ icon: User }"], usersSystem: ["Shield", "{ icon: Shield }"], usersDemo: ["UserCircle", "{ icon: UserCircle }"], notificationTemplates: [null, "{ hidden: true }"] };
  for (const [name, [icon, body]] of Object.entries(items)) {
    files[`src/features/core/admin/menu/items/${name}.ts`] = item("item", name);
    const iconImport = icon ? `import { ${icon} } from "lucide-react";\n\n` : "";
    files[`src/features/core/admin/menu/items/${name}.override.ts`] = `${iconImport}import type { AdminMenuItemOverride } from "../types";\n\nexport const override = ${body} satisfies AdminMenuItemOverride;\n`;
  }
  const plan = planExtensions(fixture(files));
  assert.deepEqual(plan.problems.filter((p) => p.includes(".override.ts")), []);
  const overridden = [...plan.itemsByPoint.values()].flat().filter((i) => i.override).map((i) => i.name).sort();
  assert.deepEqual(overridden, ["data", "maintenance", "notificationTemplates", "system", "users", "usersDemo", "usersGeneral", "usersSystem"]);
});

test("宣言: overrides の点(受け口でない上書きの対象)は overrides・side・overrideOf・addable だけ。受け口の一覧にならず、intake は .override の edit の行と addable の add の行", () => {
  const read = (body) => readDeclaration("x/extensionPoints.ts", point(body));
  const OK = `  cronTasks: { overrides: "src/app/api/cron/*/task.ts", export: "override", side: "server", overrideOf: ["schedule", "disabled"] },`;
  assert.deepEqual(read(OK).problems, []);
  assert.match(read(`  cronTasks: { overrides: "src/a/*.ts", export: "override", side: "server" },`).problems[0], /overrideOf .*必須/);
  assert.match(read(`  cronTasks: { overrides: "src/a/*.ts", export: "override", side: "server", overrideOf: ["a"], dir: "a" },`).problems[0], /overrides の点に dir は書けない/);
  assert.match(read(`  cronTasks: { overrides: "src/a/*.ts", export: "override", side: "server", overrideOf: ["a"], writer: "role:generate" },`).problems[0], /overrides の点に writer は書けない/);
  assert.match(read(`  cronTasks: { overrides: "../a/*.ts", export: "override", side: "server", overrideOf: ["a"] },`).problems[0], /overrides は対象のファイル/);
  assert.match(read(`  cronTasks: { overrides: "src/../a.ts", export: "override", side: "server", overrideOf: ["a"] },`).problems[0], /overrides は対象のファイル/);
  assert.match(read(`  cronTasks: { overrides: "src/a.ts", export: "override", side: "edge", overrideOf: ["a"] },`).problems[0], /side は/);
  const files = { "src/lib/cron/extensionPoints.ts": point(OK), "src/features/milestone/extensionPoints.ts": point(MILESTONES), "src/lib/forkOwnership/intake.txt": "# === AUTO-GENERATED intake START ===\n# === AUTO-GENERATED intake END ===\n" };
  const plan = planExtensions(fixture(files));
  assert.deepEqual(plan.problems, []);
  assert.deepEqual(Object.keys(plan.outputs), ["src/features/milestone/extensions/definitions.ts"]);
  const rowsOf = (content) => content.split("\n").filter((l) => /^(add|edit) /.test(l)).map((l) => l.split("  #")[0]);
  assert.ok(rowsOf(plan.intake.content).includes("edit src/app/api/cron/*/task.override.ts"), "上書きの対象の点 = 隣の .override.ts の edit の行");
  assert.ok(!rowsOf(plan.intake.content).includes("add src/app/api/cron/*/task.ts"), "addable の無い点は対象を足す add の行を作らない");
  const ROLES = `  roleDefinitions: { overrides: "src/features/core/user/roles/*.role.json", export: "override", addable: true, side: "shared", overrideOf: ["label"] },\n  coreRoleDefinitions: { overrides: "src/features/core/user/coreRoles/*.role.json", export: "override", side: "shared", overrideOf: ["label"] },`;
  const withRoles = planExtensions(fixture({ ...files, "src/features/core/user/extensionPoints.ts": point(ROLES) }));
  assert.deepEqual(withRoles.problems, []);
  const rows = rowsOf(withRoles.intake.content);
  assert.deepEqual(rows.filter((r) => r.includes("user/")), [
    "edit src/features/core/user/coreRoles/*.role.override.ts",
    "edit src/features/core/user/roles/*.role.override.ts",
    "add src/features/core/user/roles/*.role.json",
  ]);
  assert.match(read(`  roleDefinitions: { overrides: "src/a/*.json", export: "override", addable: false, side: "shared", overrideOf: ["a"] },`).problems[0], /addable は true だけ/);
});

test("宣言: placement の点(置き場)は placement・kind(edit | append)だけ。intake は置き場 → 画面 → 受け口 → … → region → generated の順", () => {
  const read = (body) => readDeclaration("x/extensionPoints.ts", point(body));
  assert.deepEqual(read(`  values: { placement: "src/config/**", kind: "edit" },`).problems, []);
  assert.deepEqual(read(`  catalog: { placement: "src/lib/CATALOG.md", kind: "append" },`).problems, []);
  assert.match(read(`  values: { placement: "src/config/**", kind: "add" },`).problems[0], /kind は edit \| append/);
  assert.match(read(`  values: { placement: "config/**", kind: "edit" },`).problems[0], /placement は置き場/);
  assert.match(read(`  values: { placement: "src/a/**", kind: "edit", side: "server" },`).problems[0], /placement の点に side は書けない/);
  assert.match(read(MILESTONES.replace('side: "server" }', 'side: "server", kind: "edit" }')).problems[0], /kind は placement の点だけ/);
  const rows = intakeRows(
    [
      { owner: "src/lib/a", name: "values", declaredIn: "src/lib/a/extensionPoints.ts", spec: { placement: "src/config/**", kind: "edit" } },
      { owner: "src/features/milestone", name: "definitions", declaredIn: "src/features/milestone/extensionPoints.ts", spec: { dir: "milestones", export: "m", type: { from: "a", name: "T" }, side: "server" } },
    ],
    [{ path: "src/features/core/payment/enricher.ts" }],
    { pages: ["src/app/(user)/wallet/[slug]/page.tsx"], frameSwitches: ["src/app/(user)/layout.tsx"], generators: [{ name: "registry", outputs: ["src/registry/a.ts"], regions: ["src/registry/**/*.ts"] }] },
  ).filter((r) => !r.startsWith("#")).map((r) => r.split("  #")[0]);
  const at = (row) => rows.indexOf(row);
  for (const row of ["edit src/config/**", "edit src/app/(user)/wallet/[[]slug[]]/page.tsx", "edit src/app/(user)/layout.tsx", "add src/features/milestone/milestones/*.{ts,tsx}", "edit src/features/core/payment/enricher.ts", "region src/registry/**/*.ts", "generated src/registry/a.ts"]) {
    assert.ok(at(row) >= 0, `${row} が無い`);
  }
  assert.ok(at("edit src/config/**") < at("edit src/app/(user)/wallet/[[]slug[]]/page.tsx"));
  assert.ok(at("edit src/app/(user)/layout.tsx") < at("add src/features/milestone/milestones/*.{ts,tsx}"));
  assert.ok(at("add src/app/**/frame.ts  ".trim()) < at("region src/registry/**/*.ts"));
  assert.ok(at("region src/registry/**/*.ts") < at("generated src/registry/a.ts"), "同じファイルなら生成物が効く");

// ---- 門番の規則の dependsOn(D24・D34) ----

const GATE_DECLARATION = readFileSync(join(repoRoot, "src/featureGate/extensionPoints.ts"), "utf8");
const gateRule = (body = "") => `export const rule: FeatureGateRule = {\n  pathPatterns: ["/x"],\n  ${body}\n};\n`;
const gateFixture = (rules) =>
  fixture({ "src/featureGate/extensionPoints.ts": GATE_DECLARATION, ...Object.fromEntries(Object.entries(rules).map(([name, text]) => [`src/featureGate/rules/${name}.ts`, text])) });

test("dependsOn: 字面を一覧の項目に写す(書かない規則は空、enabled の省略も通る)、生成一覧に dependsOn の欄が載る", () => {
  const plan = planExtensions(
    gateFixture({
      parent: gateRule("enabled: () => true,"),
      child: gateRule('dependsOn: ["parent"],'),
      grandchild: gateRule('// dependsOn: ["nowhere"] はコメント\n  dependsOn: [\n    "child",\n    \'parent\',\n  ],\n  enabled: () => false,'),
    }),
  );
  assert.deepEqual(plan.problems, []);
  assert.deepEqual(
    itemsOf(plan, "src/featureGate", "rules").map((item) => `${item.name}:${item.fields.dependsOn.join("|")}`),
    ["child:parent", "grandchild:child|parent", "parent:"],
  );
  const out = plan.outputs["src/featureGate/extensions/rules.ts"];
  assert.match(out, /import type \{ GatedCronTask, GatedDomain, GatedSettingSection, GeneratedFeatureRule \} from "@\/featureGate";/);
  assert.match(out, /\{ \.\.\.rules_child, name: "child", tables: \[\], domainApiPaths: \[\], settingPaths: \[\], cronPaths: \[\], dependsOn: \["parent"\], anyOf: \[\] \},/);
  assert.match(out, /\{ \.\.\.rules_parent, name: "parent", tables: \[\], domainApiPaths: \[\], settingPaths: \[\], cronPaths: \[\], dependsOn: \[\], anyOf: \[\] \},/);
});

test("dependsOn: 非リテラル・自分・重複・未知の名前・輪(推移的)を規則の名前を出して止める", () => {
  const plan = planExtensions(
    gateFixture({
      variable: gateRule("dependsOn: DEPS,"),
      spread: gateRule('dependsOn: [...BASE, "ok"],'),
      notName: gateRule('dependsOn: ["core/wallet"],'),
      selfish: gateRule('dependsOn: ["selfish"],'),
      anyUnknown: gateRule('anyOf: ["nowhere2"],'),
      anyBoth: gateRule('dependsOn: ["ok"],\n  anyOf: ["ok"],'),
      twice: gateRule('dependsOn: ["ok", "ok"],'),
      unknown: gateRule('dependsOn: ["nowhere"],'),
      a: gateRule('dependsOn: ["b"],'),
      b: gateRule('dependsOn: ["c"],'),
      c: gateRule('dependsOn: ["a"],'),
      ok: gateRule(),
    }),
  );
  const of = (name) => plan.problems.filter((p) => p.includes(`rules/${name}.ts`)).join("\n");
  assert.match(of("variable"), /dependsOn が文字列リテラルの配列でない/);
  assert.match(of("spread"), /dependsOn の要素 \.\.\.BASE が機能の名前の文字列リテラルでない/);
  assert.match(of("notName"), /dependsOn の要素 "core\/wallet" が機能の名前の文字列リテラルでない/);
  assert.match(of("selfish"), /dependsOn に自分 "selfish" を書いている/);
  assert.match(of("twice"), /dependsOn の "ok" が重複している/);
  assert.match(of("unknown"), /dependsOn の "nowhere" は無い機能/);
  assert.match(of("a"), /dependsOn が輪になっている\(a → b → c → a\)/);
  assert.match(of("anyUnknown"), /anyOf の "nowhere2" は無い機能/);
  assert.match(of("anyBoth"), /"ok" を dependsOn と anyOf の両方に書いている/);
  assert.equal(plan.problems.length, 9, plan.problems.join("\n"));
});

test("dependsOn: 読み・輪の検査の単体(輪は 1 つにつき 1 回、読めなかった規則の名前は未知にしない)", () => {
  assert.deepEqual(readDependsOn(gateRule(), "x"), { dependsOn: [] });
  assert.deepEqual(readDependsOn(gateRule('dependsOn: [],'), "x"), { dependsOn: [] });
  assert.deepEqual(readDependsOn('/* dependsOn: X */\n' + gateRule(), "x"), { dependsOn: [] });
  // anyOf も輪に数える(dependsOn と合わせた依存)
  assert.deepEqual(checkDependsOnGraph([{ path: "p.ts", name: "p", dependsOn: [], anyOf: ["q"] }, { path: "q.ts", name: "q", dependsOn: ["p"] }]), ["p.ts: dependsOn・anyOf が輪になっている(p → q → p)"]);
  const items = [
    { path: "a.ts", name: "a", dependsOn: ["b"] },
    { path: "b.ts", name: "b", dependsOn: ["a"] },
    { path: "c.ts", name: "c", dependsOn: ["c2"] },
    { path: "c2.ts", name: "c2", dependsOn: [] },
  ];
  assert.deepEqual(checkDependsOnGraph(items), ["a.ts: dependsOn が輪になっている(a → b → a)"]);
  // 実リポの規則は輪も未知も無い
  const real = planExtensions(repoRoot);
  assert.ok(!real.problems.some((p) => p.includes("dependsOn")), real.problems.join("\n"));
});

// ---- 門番の規則の requires の被覆(D24・D34 K5) ----

test("requires の被覆: 機能のドメインの requires の先が自分・依存先(推移的)・基盤のどれにも無ければ止め、直し方(dependsOn に足す機能)を示す", () => {
  const entry = (requires) => `export const domainEntries = {\n  x: { table: null${requires ? `, requires: ${JSON.stringify(requires)}` : ""} },\n} satisfies DomainEntries;\n`;
  const domains = {
    "src/features/core/wallet/services/server/domainEntry.ts": entry(),
    "src/features/core/purchase/services/server/domainEntry.ts": entry(["wallet"]),
    "src/features/core/reward/services/server/domainEntry.ts": entry(["wallet"]),
    "src/features/core/audit/services/server/domainEntry.ts": entry(),
    "src/features/core/log/services/server/domainEntry.ts": entry(["audit"]),
  };
  const r = (body) => gateRule(body);
  const plan = planExtensions(
    fixture({
      "src/featureGate/extensionPoints.ts": GATE_DECLARATION,
      ...domains,
      "src/featureGate/rules/wallet.ts": r('domains: ["core/wallet"],'),
      "src/featureGate/rules/payment.ts": r('domains: ["core/purchase"],'),
      "src/featureGate/rules/bonus.ts": r('dependsOn: ["payment"],\n  domains: ["core/reward"],'),
      "src/featureGate/rules/logs.ts": r('domains: ["core/log"],'),
    }),
  );
  const of = (name) => plan.problems.filter((p) => p.includes(`rules/${name}.ts`));
  assert.equal(of("payment").length, 1, plan.problems.join("\n"));
  assert.match(of("payment")[0], /機能 payment のドメイン core\/purchase が requires する wallet\(core\/wallet、機能 wallet\)が、この機能・依存先\(dependsOn、推移的\)・基盤のどれにも無い。dependsOn に "wallet" を足す/);
  assert.equal(of("bonus").length, 1, "依存先 payment は wallet を持たないので覆わない");
  assert.deepEqual(of("logs"), [], "requires の先 audit はどの規則にも載らない基盤");
  assert.deepEqual(of("wallet"), []);
  // payment が wallet に依存すれば payment も bonus(推移的)も覆う
  const fixed = planExtensions(
    fixture({
      "src/featureGate/extensionPoints.ts": GATE_DECLARATION,
      ...domains,
      "src/featureGate/rules/wallet.ts": r('domains: ["core/wallet"],'),
      "src/featureGate/rules/payment.ts": r('dependsOn: ["wallet"],\n  domains: ["core/purchase"],'),
      "src/featureGate/rules/bonus.ts": r('dependsOn: ["payment"],\n  domains: ["core/reward"],'),
      "src/featureGate/rules/logs.ts": r('domains: ["core/log"],'),
    }),
  );
  assert.deepEqual(fixed.problems, []);
});

test("requires の被覆: 例外の表(機能:ドメイン→先)は通し、その機能の規則があるのに当たらない行は止める", async () => {
  const { checkRequiresCoverage } = await import("./derive/gateRequires.mjs");
  const districts = [
    { folder: "core/notification", name: "notification", requires: ["notificationTemplate"] },
    { folder: "core/notificationTemplate", name: "notificationTemplate", requires: [] },
  ];
  const items = [
    { path: "n.ts", name: "notification", domains: ["core/notification"], dependsOn: [] },
    { path: "t.ts", name: "notificationTemplate", domains: ["core/notificationTemplate"], dependsOn: [] },
  ];
  const key = "notification:core/notification→core/notificationTemplate";
  assert.deepEqual(checkRequiresCoverage(items, districts, { [key]: "理由" }), []);
  assert.equal(checkRequiresCoverage(items, districts, {}).length, 1);
  assert.match(checkRequiresCoverage([items[0], items[1]].map((i) => (i.name === "notification" ? { ...i, dependsOn: ["notificationTemplate"] } : i)), districts, { [key]: "理由" })[0], /例外 .* はもう当たらない/);
  assert.deepEqual(checkRequiresCoverage([items[1]], districts, { [key]: "理由" }), [], "その機能の規則が無ければ数えない");
});
