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

import { readForkIdentity } from "../../../src/lib/forkOwnership/node.mjs";

import { readDeclaration } from "../../../src/lib/districtMap/index.mjs";
import { readDistrictMapAt } from "../../../src/lib/districtMap/node.mjs";
import { checkDependsOnGraph, readDependsOn } from "./derive/gateDependsOn.mjs";
import { checkOverrides } from "./overrides.mjs";
import { CLAIMERS, checkSwitches, isClaimedDefault } from "./switches.mjs";
import { intakeRowsOf } from "../../../src/lib/districtMap/index.mjs";
import { headerFor, itemsOf, planExtensions, pointsEntryProblems, staleOutputs, strayExtensionFiles } from "./extensions.mjs";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");

/** fork(acme、祖先 parent)の一時リポにファイルを置く */
function fixture(files) {
  const root = mkdtempSync(join(tmpdir(), "extensions-"));
  const put = (path, text) => {
    mkdirSync(dirname(join(root, path)), { recursive: true });
    writeFileSync(join(root, path), text);
  };
  put("repo.json", '{"repo_id": "acme", "tier": "leaf"}\n');
  put(".notices/applied/parent.md", "");
  put("src/lib/CATALOG.md", "## next-starter\n\n## parent\n\n## acme\n");
  for (const [path, text] of Object.entries(files)) put(path, text);
  return root;
}

const point = (body) => `export const extensionPoints = {\n${body}\n};\n`;
/** 差替点の宣言(持ち主 = 既定のフォルダ。名前 = スイッチの名前の先頭を小文字) */
const replacesOf = (paths) =>
  paths.map((path) => {
    const owner = path.slice(0, path.lastIndexOf("/"));
    const name = path.slice(owner.length + 1).replace(/\.default\.tsx?$/, "");
    return { owner, name: name[0].toLowerCase() + name.slice(1), declaredIn: `${owner}/extensionPoints.ts`, spec: { change: "replace", default: path, type: { from: "@/t", name: "T" }, side: "server" } };
  });
const MILESTONES = `  definitions: { change: "add", dir: "milestones", export: "milestone", type: { from: "@/domains/milestone/types", name: "MilestoneDefinition" }, side: "server" },`;

test("宣言: リテラル以外・未知のキー・点の名前の形・欠けたキーは失敗", () => {
  const bad = (body) => readDeclaration("x/extensionPoints.ts", point(body)).problems;
  assert.deepEqual(readDeclaration("x/extensionPoints.ts", point(MILESTONES)).problems, []);
  assert.match(bad(`  definitions: { change: "add", dir: DIR, export: "m", type: { from: "a", name: "T" }, side: "server" },`)[0], /リテラルでない値\(DIR\)/);
  assert.match(bad(`  definitions: { change: "add", dir: "m", export: "m", type: { from: "a", name: "T" }, side: "server", ...rest },`)[0], /リテラルでない書き方/);
  assert.match(bad(`  definitions: { change: "add", dir: \`m\${x}\`, export: "m", type: { from: "a", name: "T" }, side: "server" },`)[0], /リテラルでない値/);
  assert.match(bad(`  definitions: { change: "add", dir: "m", export: "m", type: { from: "a", name: "T" }, side: "server", sort: 1 },`)[0], /未知のキー sort/);
  assert.match(bad(`  Definitions: { dir: "m", export: "m", type: { from: "a", name: "T" }, side: "server" },`)[0], /英小文字始まり/);
  assert.ok(bad(`  definitions: { change: "add", dir: "../m", export: "m", type: { from: "a" }, side: "edge", derive: "mine" },`).length >= 4);
  assert.match(readDeclaration("x/extensionPoints.ts", "export const other = {};\n").problems[0], /export const extensionPoints/);
});

test("走査: ファイルとフォルダの 2 形・名前の順。src の下のどこでも宣言を読む", () => {
  const M = "export const milestone = { id: 1 };\n";
  const root = fixture({
    "src/domains/milestone/extensionPoints.ts": point(MILESTONES),
    "src/domains/milestone/milestones/zeta.ts": M,
    "src/domains/milestone/milestones/alpha.ts": M,
    "src/domains/milestone/milestones/beta/index.tsx": M,
    "src/domains/milestone/milestones/beta/part.ts": "export const x = 1;\n",
    "src/domains/milestone/milestones/gamma.tsx": M,
    "src/domains/milestone/milestones/zeta.test.ts": M,
    "src/domains/milestone/milestones/notes.md": "x",
  });
  const plan = planExtensions(root);
  assert.deepEqual(plan.problems, []);
  assert.deepEqual(
    itemsOf(plan, "src/domains/milestone", "definitions").map((i) => i.name),
    ["alpha", "beta", "gamma", "zeta"],
  );
  const out = plan.outputs["src/domains/milestone/extensions/definitions.ts"];
  assert.ok(out.startsWith(`${headerFor("src/domains/milestone/extensionPoints.ts")}\n`));
  assert.match(out, /import type \{ MilestoneDefinition \} from "@\/domains\/milestone\/types";/);
  assert.match(out, /import \{ milestone as definitions_alpha \} from "@\/domains\/milestone\/milestones\/alpha";/);
  assert.match(out, /import \{ milestone as definitions_beta \} from "@\/domains\/milestone\/milestones\/beta";/);
  assert.match(out, /export const definitions: MilestoneDefinition\[\] = \[\n  definitions_alpha,\n  definitions_beta,\n  definitions_gamma,\n  definitions_zeta,\n\];/);
});

test("失敗: 旧い fork の印(移し方を案内)・export が無い・index の無いフォルダ・同じ名前のファイルとフォルダ・名前の形", () => {
  const M = "export const milestone = 1;\n";
  const root = fixture({
    "src/domains/milestone/extensionPoints.ts": point(MILESTONES),
    "src/domains/milestone/milestones/a.other.ts": M,
    "src/domains/milestone/milestones/helper.ts": "export function helper() {}\n",
    "src/domains/milestone/milestones/empty/readme.md": "x",
    "src/domains/milestone/milestones/dup.ts": M,
    "src/domains/milestone/milestones/dup/index.ts": M,
    "src/domains/milestone/milestones/x.a.b.ts": M,
    "src/domains/milestone/milestones/old.acme/index.ts": M,
    "src/domains/milestone/milestones/x.default.ts": M,
    "src/domains/milestone/milestones/1bad.ts": M,
    "src/domains/milestone/milestones/ok.ts": M,
  });
  const plan = planExtensions(root);
  assert.deepEqual(itemsOf(plan, "src/domains/milestone", "definitions").map((i) => i.name), ["dup", "ok"]);
  const find = (s) => plan.problems.find((p) => p.includes(s)) ?? "";
  assert.match(find("a.other.ts"), /印なしの a\.ts に改名/);
  assert.ok(find("a.other.ts").includes("shared-shelf marker migration notice"));
  assert.match(find("x.a.b.ts"), /印なしの x\.ts に改名/);
  assert.match(find("old.acme"), /印なしの old\/ に改名/);

  assert.match(find("1bad.ts"), /名前の形/);
  assert.match(find("helper.ts"), /export const milestone が無い/);
  assert.match(find("empty"), /index\.ts\(x\)/);
  assert.match(find("/dup.ts"), /同じ名前の項目/);
  // x.default.ts は項目として数えず(<名前>.default は 1 行スイッチの既定、注文 30)、スイッチの検査が止める(差替点の宣言が無い)
  assert.match(find("x.default.ts"), /差替点の宣言が無い/);
  assert.equal(plan.problems.length, 8, plan.problems.join("\n"));
});

test("fork の宣言: fork 自身のフォルダの extensionPoints.ts は上流と同じに読む。旧い extensionPoints.<x>.ts は止めて移し方を案内する", () => {
  const root = fixture({
    "src/domains/core/user/extensionPoints.ts": point(`  cleanupHandlers: { change: "add", dir: "cleanup", export: "handler", type: { from: "@/domains/user/types", name: "CleanupHandler" }, side: "server" },`),
    "src/domains/core/user/extensionPoints.acme.ts": point(`  badges: { change: "add", dir: "badges", export: "badge", type: { from: "@/domains/user/types", name: "Badge" }, side: "client" },`),
    "src/domains/core/user/extensionPoints.test.ts": "export const x = 1;\n",
    "src/domains/acmeBadge/extensionPoints.ts": point(`  badges: { change: "add", dir: "badges", export: "badge", type: { from: "@/domains/acmeBadge/types", name: "Badge" }, side: "client" },`),
    "src/domains/core/user/cleanup/a.ts": "export const handler = 1;\n",
    "src/domains/acmeBadge/badges/gold.tsx": "export const badge = 1;\n",
  });
  const plan = planExtensions(root);
  assert.deepEqual(plan.points.map((p) => `${p.owner}:${p.name}`).sort(), ["src/domains/acmeBadge:badges", "src/domains/core/user:cleanupHandlers"]);
  assert.equal(plan.problems.length, 1, plan.problems.join("\n"));
  assert.ok(plan.problems[0].includes("extensionPoints.acme.ts") && plan.problems[0].includes("fork 自身のフォルダ") && plan.problems[0].includes("shared-shelf marker migration notice"));
  assert.match(plan.outputs["src/domains/acmeBadge/extensions/badges.ts"], /import \{ badge as badges_gold \} from "@\/domains\/acmeBadge\/badges\/gold";/);
});

test("受け口の override と .replace: overrideOf の無い点は override を受けない(空は不在)、.replace は項目でなく孤立はスイッチの検査で止まる", () => {
  const M = "export const milestone = 1;\n";
  const plan = planExtensions(
    fixture({
      "src/domains/milestone/extensionPoints.ts": point(MILESTONES),
      "src/domains/milestone/milestones/a.ts": M,
      "src/domains/milestone/milestones/a.override.ts": "export const override = {};\n",
      "src/domains/milestone/milestones/b.override.ts": "// 空\n",
      "src/domains/milestone/milestones/a.replace.ts": M,
    }),
  );
  assert.deepEqual(itemsOf(plan, "src/domains/milestone", "definitions").map((i) => i.name), ["a"]);
  assert.equal(plan.problems.length, 2, plan.problems.join("\n"));
  assert.ok(plan.problems.some((p) => p.includes("a.override.ts") && p.includes("override を受けない")));
  assert.ok(plan.problems.some((p) => p.includes("a.replace.ts") && p.includes("孤立した .replace")));
});

test("受け口の一覧(intake.txt)の生成区画: 受け口のフォルダ(dir \".\"・files の点も)・1 行スイッチの .replace・route の隣・scripts の受け口の add を書き、印の無い一覧は失敗、無い fixture は null", () => {
  const INTAKE = "edit src/config/**  # 値\n# === AUTO-GENERATED intake START ===\nadd old/*.ts  # 古い行\n# === AUTO-GENERATED intake END ===\nappend src/lib/CATALOG.md  # 目録\n";
  const files = {
    "src/domains/milestone/extensionPoints.ts": point(MILESTONES),
    "src/proxies/extensionPoints.ts": point(`  handlers: { change: "add", dir: ".", export: "handler", type: { from: "@/t", name: "H" }, side: "server" },\n  decorators: { change: "add", dir: ".", export: "decorator", type: { from: "@/t", name: "D" }, side: "server" },`),
    "src/app/demo/extensionPoints.ts": point(`  pages: { change: "add", dir: ".", files: "*/_demo.ts", export: "demo", type: { from: "@/t", name: "T" }, side: "shared" },`),
    "src/domains/core/user/extensionPoints.ts": point(`  roles: { change: "add", writer: "role:generate", side: "shared" },`),
    "src/domains/core/payment/enricher.default.ts": "export function enrich() {}\n",
    "src/domains/core/payment/enricher.ts": 'export { enrich } from "./enricher.default";\n',
    "src/domains/core/payment/extensionPoints.ts": point(`  enricher: { change: "replace", default: "src/domains/core/payment/enricher.default.ts", type: { from: "@/t", name: "E" }, side: "server" },`),
  };
  assert.equal(planExtensions(fixture(files)).intake, null);
  const plan = planExtensions(fixture({ ...files, "src/lib/forkOwnership/intake.txt": INTAKE }));
  assert.deepEqual(plan.problems, []);
  assert.equal(plan.intake.path, "src/lib/forkOwnership/intake.txt");
  assert.ok(plan.intake.content.includes("\nedit src/domains/core/payment/enricher.ts  # 差替点 enricher(src/domains/core/payment/extensionPoints.ts)の 1 行スイッチ"), "1 行スイッチの素の名前は edit の行");
  const rows = plan.intake.content.split("\n").filter((l) => /^add /.test(l)).map((l) => l.split("  #")[0]);
  assert.deepEqual(rows, [
    "add src/app/demo/*/_demo.ts",
    "add src/domains/milestone/milestones/*.{ts,tsx}",
    "add src/domains/milestone/milestones/*/**",
    "add src/proxies/*.{ts,tsx}",
    "add src/proxies/*/**",
    "add src/domains/core/payment/enricher.replace.{ts,tsx}",
    "add src/app/**/_layout/**/*.replace.{ts,tsx}",
    "add src/app/**/_screen/**/*.replace.{ts,tsx}",
    "add src/app/**/frame.override.ts",
  ]);
  assert.ok(plan.intake.content.startsWith("edit src/config/**  # 値\n# === AUTO-GENERATED intake START ===\n"));
  assert.ok(plan.intake.content.endsWith("# === AUTO-GENERATED intake END ===\nappend src/lib/CATALOG.md  # 目録\n"), "区画の外は変えない");
  assert.equal(Object.keys(plan.outputs).includes("src/lib/forkOwnership/intake.txt"), false, "一覧の数には入れない");
  const broken = planExtensions(fixture({ ...files, "src/lib/forkOwnership/intake.txt": "edit src/config/**  # 値\n" }));
  assert.ok(broken.problems.some((p) => p.includes("intake.txt") && p.includes("生成区画の印の対")));
  // files の点の overrideOf: 項目のファイルの隣の override も add の行
  const withOverride = planExtensions(
    fixture({
      ...files,
      "src/app/demo/extensionPoints.ts": point(`  pages: { change: "add", dir: ".", files: "*/_demo.ts", export: "demo", type: { from: "@/t", name: "T" }, side: "shared", overrideOf: ["disabled"] },`),
      "src/lib/forkOwnership/intake.txt": INTAKE,
    }),
  );
  assert.deepEqual(withOverride.problems, []);
  const demoRows = withOverride.intake.content.split("\n").filter((l) => l.startsWith("add src/app/demo/")).map((l) => l.split("  #")[0]);
  assert.deepEqual(demoRows, ["add src/app/demo/*/_demo.override.{ts,tsx}", "add src/app/demo/*/_demo.ts"]);
});

test("受け口のフォルダが無い点は項目 0 で通る(空の一覧を出す)。alwaysOn は真偽だけ", () => {
  const root = fixture({ "src/domains/milestone/extensionPoints.ts": point(MILESTONES) });
  const plan = planExtensions(root);
  assert.deepEqual(plan.problems, []);
  assert.match(plan.outputs["src/domains/milestone/extensions/definitions.ts"], /export const definitions: MilestoneDefinition\[\] = \[\];/);
  assert.match(readDeclaration("x/extensionPoints.ts", point(`  a: { change: "add", dir: "a", export: "a", type: { from: "a", name: "T" }, side: "server", alwaysOn: "yes" },`)).problems[0], /alwaysOn は真偽/);
});

test("描画: literalKeys は鍵の文字列を型に残す。key なし・true 以外は失敗", () => {
  const root = fixture({
    "src/domains/core/pairedDevice/extensionPoints.ts": point(`  kinds: { change: "add", dir: "kinds", export: "kind", type: { from: "@/x", name: "K" }, side: "server", key: "kind", literalKeys: true },`),
    "src/domains/core/pairedDevice/kinds/terminal.ts": "export const kind = {};\n",
  });
  const out = planExtensions(root).outputs["src/domains/core/pairedDevice/extensions/kinds.ts"];
  assert.match(out, /const kindsList = \[\n  kinds_terminal,\n\] as const satisfies readonly K\[\];/);
  assert.match(out, /as unknown as \{ readonly \[I in \(typeof kindsList\)\[number\] as I\["kind"\]\]: I \};/);
  assert.match(out, /kind が重複/);
  const bad = (body) => readDeclaration("x/extensionPoints.ts", point(body)).problems[0];
  assert.match(bad(`  a: { change: "add", dir: "a", export: "a", type: { from: "a", name: "T" }, side: "server", literalKeys: true },`), /literalKeys は key と一緒に/);
});

test("描画: key の Record・lazy の import・lib の target wiring は src/wiring/<lib>.ts に 1 本", () => {
  const root = fixture({
    "src/domains/core/userLineProfile/extensionPoints.ts": point(
      `  webhookHandlers: { change: "add", dir: "webhooks", export: "webhookHandler", type: { from: "@/domains/userLineProfile/types", name: "LineWebhookHandler" }, side: "server", key: "eventType" },`,
    ),
    "src/domains/core/userLineProfile/webhooks/follow.ts": "export const webhookHandler = { eventType: \"follow\" };\n",
    // lazy の点(管理者コマンドの点は段 3 で src/app/_layout/adminCommand から adminCommand のドメインへ移った)
    "src/domains/core/adminCommand/extensionPoints.ts": point(
      `  plugins: { change: "add", dir: "plugins", export: "plugin", type: { from: "@/domains/adminCommand/types", name: "AdminCommandPlugin" }, side: "client", load: "lazy" },`,
    ),
    "src/domains/core/adminCommand/plugins/search/index.tsx": "export const plugin = {};\n",
    "src/lib/dbAgent/extensionPoints.ts": point(
      `  tools: { change: "add", dir: "tools", export: "tool", type: { from: "@/lib/dbAgent/types", name: "DbAgentTool" }, side: "server", target: "wiring" },\n  prompts: { change: "add", dir: "prompts", export: "prompt", type: { from: "@/lib/dbAgent/types", name: "DbAgentPrompt" }, side: "server", target: "wiring" },`,
    ),
    "src/lib/dbAgent/tools/query.ts": "export const tool = {};\n",
    "src/lib/dbAgent/prompts/base.ts": "export const prompt = {};\n",
    // 1 本の wiring に混ざる別の点の同じ名前の項目(別名は点の名前で分かれる)
    "src/lib/dbAgent/prompts/query.ts": "export const prompt = {};\n",
  });
  const plan = planExtensions(root);
  assert.deepEqual(plan.problems, []);
  const keyed = plan.outputs["src/domains/core/userLineProfile/extensions/webhookHandlers.ts"];
  assert.match(keyed, /const webhookHandlersList: LineWebhookHandler\[\] = \[\n  webhookHandlers_follow,\n\];/);
  assert.match(keyed, /export const webhookHandlers: Readonly<Record<string, LineWebhookHandler>> = Object\.assign\(Object\.create\(null\), Object\.fromEntries\(webhookHandlersList\.map\(\(item\) => \[String\(item\.eventType\), item\]\)\)\);/);
  const lazy = plan.outputs["src/domains/core/adminCommand/extensions/plugins.ts"];
  assert.match(lazy, /\{ name: "search", load: \(\) => import\("@\/domains\/core\/adminCommand\/plugins\/search"\)\.then\(\(m\) => m\.plugin\) \},/);
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
    "src/domains/milestone/extensionPoints.ts": point(MILESTONES),
    "src/domains/milestone/milestones/a.ts": "export const milestone = 1;\n",
    "src/domains/milestone/extensions/handMade.ts": "export const x = 1;\n",
    "src/domains/milestone/extensions/old.ts": `${headerFor("src/domains/milestone/extensionPoints.ts")}\nexport const old = [];\n`,
    "src/domains/other/extensions/x.ts": "export const x = 1;\n",
  });
  const plan = planExtensions(root);
  assert.deepEqual(staleOutputs(root, plan.outputs), ["src/domains/milestone/extensions/definitions.ts"]);
  for (const [path, content] of Object.entries(plan.outputs)) writeFileSync(join(root, path), content);
  assert.deepEqual(staleOutputs(root, plan.outputs), []);
  const strays = strayExtensionFiles(root, plan.outputs, plan.points);
  assert.deepEqual(
    strays.map((s) => `${s.path}:${s.generated}:${s.hint}`),
    [
      "src/domains/milestone/extensions/handMade.ts:false:受け口は src/domains/milestone/milestones",
      "src/domains/milestone/extensions/old.ts:true:受け口は src/domains/milestone/milestones",
      "src/domains/other/extensions/x.ts:false:src/domains/other に拡張点の宣言(extensionPoints.ts)が無い",
    ],
  );
  assert.ok(existsSync(join(root, "src/domains/milestone/extensions/definitions.ts")));
});

test("1 行スイッチ: src/app の frame.default.ts は枠の宣言の既定でスイッチではない(隣の frame.ts も不在も問わない)", () => {
  const root = fixture({
    "src/app/(user)/a/page.tsx": "export default 1;\n",
    "src/app/(user)/a/frame.default.ts": "export const frameDefault = { page: {} };\n",
    "src/app/(user)/b/page.tsx": "export default 1;\n",
    "src/app/(user)/b/frame.default.ts": "export const frameDefault = { page: {} };\n",
    "src/app/(user)/b/frame.ts": "export const frame = { page: { fill: true } };\n",
    "src/domains/core/x/frame.default.ts": "export const x = 1;\n",
  });
  try {
    for (const isTier1 of [true, false]) {
      const { switches, problems } = checkSwitches(root, { isTier1, points: [] });
      assert.deepEqual(switches, []);
      assert.equal(problems.length, 1, problems.join("\n"));
      assert.match(problems[0], /^src\/domains\/core\/x\/frame\.default\.ts: 差替点の宣言が無い/, "src/app の外の frame.default は今どおりスイッチの既定");
    }
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("1 行スイッチ: .default を使うほかの仕組みは形を名乗れば外れる(name でも pattern でも)、名乗りの無い .default は今どおりスイッチの既定", () => {
  const root = fixture({
    "src/domains/core/theme/palette.default.ts": "export const palette = {};\n",
    "src/domains/core/theme/tokens/accent.default.ts": "export const accent = 1;\n",
    "src/domains/core/other/x.default.ts": "export const x = 1;\n",
  });
  try {
    const claims = [...CLAIMERS, { by: "test(名前で)", under: "src/domains/core/theme", name: "palette.default.ts" }, { by: "test(形で)", under: "src/domains/core/theme/tokens", pattern: /^[a-z]+\.default\.ts$/ }];
    const { problems } = checkSwitches(root, { isTier1: true, points: [], claims });
    assert.equal(problems.length, 1, problems.join("\n"));
    assert.match(problems[0], /^src\/domains\/core\/other\/x\.default\.ts: 差替点の宣言が無い/);
    assert.equal(checkSwitches(root, { isTier1: true, points: [] }).problems.length, 3, "名乗りが無ければ全部スイッチの既定");
    assert.equal(isClaimedDefault("src/app/(user)/frame.default.ts"), true, "枠の仕組み(frames.mjs)の名乗り");
    assert.equal(isClaimedDefault("src/domains/core/x/frame.default.ts"), false);
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
    const points = replacesOf(["src/app/admin/_layout/AdminHeader.default.tsx"]);
    const tier1 = checkSwitches(upstream, { isTier1: true, points });
    assert.deepEqual(tier1.problems, []);
    assert.deepEqual(tier1.switches.map((sw) => sw.path), ["src/app/admin/_layout/AdminHeader.tsx"]);
    assert.ok(intakeRowsOf({ points: [], switches: tier1.switches }).includes("add src/app/admin/_layout/AdminHeader.replace.{ts,tsx}  # 差替点 adminHeader の丸ごと置き換え"));
    assert.deepEqual(checkSwitches(fork, { isTier1: false, points }).problems, []);
    assert.match(checkSwitches(fork, { isTier1: true, points }).problems.join(), /AdminHeader\.tsx/, "上流のスイッチは .default を指す");
  } finally {
    rmSync(upstream, { recursive: true, force: true });
    rmSync(fork, { recursive: true, force: true });
  }
});

test("1 行スイッチ: .default の隣の素の名前は re-export 1 文だけ、先は .default か .replace(実在する)、旧い印は止める、Tier1 は .default", () => {
  const D = "export function enrich() {}\n";
  const root = fixture({
    "src/domains/core/payment/enricher.default.ts": D,
    "src/domains/core/payment/enricher.ts": '// 採用者所有のスイッチ\nexport { enrich } from "./enricher.default";\n',
    "src/domains/core/payment/enricher.replace.ts": D,
    "src/domains/core/a/x.default.ts": D,
    "src/domains/core/a/x.ts": 'export * from "./x.replace";\n',
    "src/domains/core/a/x.replace.ts": D,
    "src/domains/core/b/y.default.tsx": D,
    "src/domains/core/b/y.tsx": 'export { default } from "./y.default";\nexport const z = 1;\n',
    "src/domains/core/c/z.default.ts": D,
    "src/domains/core/c/z.ts": 'export * from "./z.other";\n',
    "src/domains/core/d/w.default.ts": D,
    "src/domains/core/d/w.ts": 'export * from "./w.replace";\n',
    "src/domains/core/e/v.default.ts": D,
    "src/domains/core/f/u.default.ts": D,
    "src/domains/core/f/u.ts": 'export * from "../g/u";\n',
    "src/domains/core/h/only.replace.ts": D,
    "src/app/x/_layout/XLayout.replace.tsx": D,
    "src/domains/core/i/t.default.ts": D,
    "src/domains/core/i/t.ts": 'export * from "./t.custom.x";\n',
  });
  const points = replacesOf(["payment/enricher.default.ts", "a/x.default.ts", "b/y.default.tsx", "c/z.default.ts", "d/w.default.ts", "e/v.default.ts", "f/u.default.ts", "i/t.default.ts"].map((p) => `src/domains/core/${p}`));
  const fork = checkSwitches(root, { isTier1: false, points });
  assert.deepEqual(fork.switches.map((s) => `${s.path}>${s.target}`), ["src/domains/core/a/x.ts>x.replace", "src/domains/core/payment/enricher.ts>enricher.default"]);
  const reason = (r, s) => r.problems.find((p) => p.includes(s)) ?? "";
  assert.match(reason(fork, "b/y.tsx"), /re-export 1 文だけ/);
  assert.match(reason(fork, "c/z.ts"), /印なしの z\.replace\.ts\(x\) に改名/);
  assert.match(reason(fork, "d/w.ts"), /w\.replace\.ts\(x\) が無い/);
  assert.match(reason(fork, "i/t.ts"), /t\.default か t\.replace だけ/);
  assert.match(reason(fork, "e/v.default.ts"), /スイッチ v\.ts\(x\) が無い/);
  assert.match(reason(fork, "f/u.ts"), /re-export 1 文だけ/);
  assert.ok(!fork.problems.some((p) => p.includes("only.replace") || p.includes("_layout")), "孤立した .replace は孤立の検査 orphans.mjs の側");
  assert.equal(fork.problems.length, 6, fork.problems.join("\n"));

  const tier1 = checkSwitches(root, { isTier1: true, points });
  assert.match(reason(tier1, "a/x.ts"), /上流\(Tier1\)のスイッチは x\.default を指す/);
  assert.deepEqual(tier1.switches.map((s) => s.path), ["src/domains/core/payment/enricher.ts"]);
});

test("1 行スイッチ: 組は差替点の宣言から。宣言の無い .default・default の無いファイル・宣言した地区の外(枠の地区の src/app の下は通す)・同じ default の 2 点は止める", () => {
  const D = "export function f() {}\n";
  const root = fixture({
    "src/domains/core/a/x.default.ts": D,
    "src/domains/core/a/x.ts": 'export { f } from "./x.default";\n',
    "src/domains/core/b/undeclared.default.ts": D,
    "src/domains/core/b/undeclared.ts": 'export { f } from "./undeclared.default";\n',
    "src/app/_providers/P.default.tsx": D,
    "src/app/_providers/P.tsx": 'export { f } from "./P.default";\n',
    "src/domains/core/c/out.default.ts": D,
    "src/domains/core/c/out.ts": 'export { f } from "./out.default";\n',
  });
  const spec = (path) => ({ change: "replace", default: path, type: { from: "@/t", name: "T" }, side: "server" });
  const at = (owner, name, path) => ({ owner, name, declaredIn: `${owner}/extensionPoints.ts`, spec: spec(path) });
  const points = [
    at("src/domains/core/a", "x", "src/domains/core/a/x.default.ts"),
    at("src/domains/core/a", "x2", "src/domains/core/a/x.default.ts"),
    at("src/app/_layout", "p", "src/app/_providers/P.default.tsx"),
    at("src/domains/core/d", "out", "src/domains/core/c/out.default.ts"),
    at("src/domains/core/a", "gone", "src/domains/core/a/gone.default.ts"),
    at("src/lib/m", "bad", "src/lib/m/notADefault.ts"),
  ];
  const { switches, problems } = checkSwitches(root, { isTier1: true, points });
  assert.deepEqual(switches.map((s) => `${s.path}:${s.point}`), ["src/app/_providers/P.tsx:p", "src/domains/core/a/x.ts:x"]);
  const find = (s) => problems.find((p) => p.includes(s)) ?? "";
  assert.match(find("x2"), /と重なる/);
  assert.match(find("out.default.ts が宣言した地区"), /の外/);
  assert.match(find("c/out.default.ts: 差替点の宣言が無い"), /差替点の宣言が無い/, "外を指す宣言は宣言に数えない");
  assert.match(find("undeclared.default.ts"), /差替点の宣言が無い/);
  assert.match(find("gone"), /gone\.default\.ts が無い/);
  assert.match(find("notADefault"), /<名前>\.default\.ts\(x\)/);
  assert.equal(problems.length, 6, problems.join("\n"));
});

// ---- plugs の点(差す側の <ドメイン>/plugs/<点>/ から集める、D38・D40・D41・D53) ----

const ENTRY_REQUIRES = (key, requires) => `export const domainEntries = { ${key}: { service: () => import("./s"), table: null, idColumn: null, requires: ${JSON.stringify(requires)} } };\n`;

test("宣言: plugs は true だけで、dir・ignore と併用不可(上書き・形・導出・常時・files は受ける、注文 25)。itemsOf は同じ宣言の files を持つ plugs の点だけ", () => {
  const read = (body) => readDeclaration("x/extensionPoints.ts", point(body)).problems;
  assert.deepEqual(read(`  deviceHandlers: { change: "add", plugs: true, export: "plug", type: { from: "@/x", name: "D" }, side: "server", max: 1 },`), []);
  assert.match(read(`  a: { change: "add", plugs: false, export: "plug", type: { from: "@/x", name: "D" }, side: "server" },`)[0], /plugs は true だけ/);
  assert.match(read(`  a: { change: "add", plugs: true, dir: "a", export: "plug", type: { from: "@/x", name: "D" }, side: "server" },`)[0], /plugs の点に dir は書けない/);
  assert.deepEqual(read(`  a: { change: "add", plugs: true, export: "plug", type: { from: "@/x", name: "D" }, side: "server", overrideOf: ["x"], alwaysOn: true },`), []);
  assert.match(read(`  a: { change: "add", plugs: true, ignore: ["x"], export: "plug", type: { from: "@/x", name: "D" }, side: "server" },`)[0], /plugs の点に ignore は書けない/);
  const L = (extra) => `  layouts: { change: "add", plugs: true, files: "*/layout.ts", export: "layout", type: { from: "@/x", name: "L" }, side: "server" },\n  emails: { change: "add", plugs: true, ${extra}, export: "email", type: { from: "@/x", name: "E" }, side: "server" },`;
  assert.deepEqual(read(L('itemsOf: "layouts", files: "*/email.tsx"')), []);
  assert.match(read(L('itemsOf: "layouts"'))[0], /itemsOf は同じ宣言の plugs の点の名前で、files と一緒に/);
  assert.match(read(L('itemsOf: "nope", files: "*/email.tsx"'))[0], /itemsOf の nope は同じ宣言の files を持つ plugs の点/);
  assert.match(read(`  a: { change: "add", dir: "a", itemsOf: "b", export: "a", type: { from: "@/x", name: "A" }, side: "server" },`)[0], /itemsOf は plugs の点だけ/);
});

test("plugs の点: 全ドメイン(core・業務)と lib の plugs/<点>/ を集め、項目に domain・requires を付ける。並びは <差す側>/<名前>、lazy は load、フォルダ形も", () => {
  const P = "export const plug = 1;\n";
  const plan = planExtensions(
    fixture({
      "src/lib/routeFactory/extensionPoints.ts": point(`  routeUsers: { change: "add", plugs: true, export: "plug", type: { from: "@/lib/routeFactory/points", name: "RouteUserPlug" }, side: "server", target: "wiring" },\n  routeLazies: { change: "add", plugs: true, export: "plug", type: { from: "@/lib/routeFactory/points", name: "L" }, side: "server", load: "lazy" },`),
      "src/domains/core/auth/services/server/domainEntry.ts": ENTRY_REQUIRES("auth", []),
      "src/domains/core/auth/plugs/routeUsers/session.ts": P,
      "src/domains/acme/services/server/domainEntry.ts": ENTRY_REQUIRES("acme", ["wallet", "coupon"]),
      "src/domains/acme/plugs/routeUsers/kiosk/index.ts": P,
      "src/domains/acme/plugs/routeUsers/session.ts": P,
      "src/domains/acme/plugs/routeLazies/late.ts": P,
      "src/lib/kioskKit/plugs/routeUsers/fallback.ts": P,
      "src/lib/kioskKit/index.ts": "export {};\n",
    }),
  );
  assert.deepEqual(plan.problems, []);
  const out = plan.outputs["src/wiring/routeFactory.ts"];
  assert.ok(out, Object.keys(plan.outputs).join("\n"));
  assert.match(out, /import \{ plug as routeUsers_acme_kiosk \} from "@\/domains\/acme\/plugs\/routeUsers\/kiosk";/);
  assert.match(out, /export const routeUsers: \{ domain: string \| null; name: string; requires: readonly string\[\]; plug: RouteUserPlug \}\[\] = \[/);
  const rows = out.split("\n").filter((l) => l.startsWith("  { domain"));
  assert.deepEqual(rows, [
    '  { domain: "acme", name: "kiosk", requires: ["coupon", "wallet"], plug: routeUsers_acme_kiosk },',
    '  { domain: "acme", name: "session", requires: ["coupon", "wallet"], plug: routeUsers_acme_session },',
    '  { domain: "auth", name: "session", requires: [], plug: routeUsers_auth_session },',
    '  { domain: null, name: "fallback", requires: [], plug: routeUsers_kioskKit_fallback },',
  ]);
  assert.match(plan.outputs["src/lib/routeFactory/extensions/routeLazies.ts"], /\{ domain: "acme", name: "late", requires: \["coupon", "wallet"\], load: \(\) => import\("@\/domains\/acme\/plugs\/routeLazies\/late"\)\.then\(\(m\) => m\.plug\) \}/);
});

test("plugs の点の keyPrefix district: 鍵の先頭が項目を置いた地区なら通り、違う・点の無い・字面で読めない鍵は止める。宣言は plugs + key と一緒の \"district\" だけ", () => {
  const H = (kind) => `export const handler = { kind: ${kind} };\n`;
  const plan = planExtensions(
    fixture({
      "src/lib/box/extensionPoints.ts": point(`  boxHandlers: { change: "add", plugs: true, export: "handler", type: { from: "@/x", name: "H" }, side: "server", key: "kind", keyPrefix: "district" },`),
      "src/domains/a/plugs/boxHandlers/good.ts": H('"a.sync"'),
      "src/lib/mailKit/plugs/boxHandlers/libGood.ts": H('"mailKit.send"'),
      "src/domains/a/plugs/boxHandlers/other.ts": H('"b.sync"'),
      "src/domains/b/plugs/boxHandlers/noDot.ts": H('"b"'),
      "src/domains/b/plugs/boxHandlers/computed.ts": H("KIND"),
    }),
  );
  const lines = plan.problems.filter((p) => p.includes("boxHandlers"));
  assert.ok(lines.some((p) => p.startsWith("src/domains/a/plugs/boxHandlers/other.ts") && /kind "b\.sync" の先頭は項目を置いた地区 a にする/.test(p)), lines.join("\n"));
  assert.ok(lines.some((p) => p.startsWith("src/domains/b/plugs/boxHandlers/noDot.ts") && /先頭は項目を置いた地区 b/.test(p)));
  assert.ok(lines.some((p) => p.startsWith("src/domains/b/plugs/boxHandlers/computed.ts") && /字面/.test(p)));
  assert.equal(lines.length, 3, lines.join("\n"));
  const bad = (spec) => readDeclaration("src/lib/box/extensionPoints.ts", point(`  boxHandlers: { change: "add", plugs: true, export: "handler", type: { from: "@/x", name: "H" }, side: "server"${spec} },`)).problems.join("\n");
  assert.match(bad(', keyPrefix: "district"'), /keyPrefix は plugs の点で key と一緒に "district" だけ/);
  assert.match(bad(', key: "kind", keyPrefix: "owner"'), /keyPrefix は/);
  assert.equal(bad(', key: "kind", keyPrefix: "district"'), "");
});

test("plugs の点: 上限 max・順位 order declared・鍵の全体の一意・知らない点のフォルダ・点の名前の重なり・export の無い項目は止める", () => {
  const P = (extra = "") => `export const plug = { kind: "k" };\n${extra}`;
  const plan = planExtensions(
    fixture({
      "src/lib/routeFactory/extensionPoints.ts": point(`  routeFactoryDevice: { change: "add", plugs: true, export: "plug", type: { from: "@/x", name: "D" }, side: "server", max: 1 },\n  ranked: { change: "add", plugs: true, export: "plug", type: { from: "@/x", name: "R" }, side: "server", order: "declared" },\n  kinds: { change: "add", plugs: true, export: "plug", type: { from: "@/x", name: "K" }, side: "server", key: "kind" },`),
      "src/lib/zother/extensionPoints.ts": point(`  kinds: { change: "add", plugs: true, export: "plug", type: { from: "@/x", name: "K" }, side: "server" },`),
      "src/domains/a/plugs/routeFactoryDevice/one.ts": P(),
      "src/domains/b/plugs/routeFactoryDevice/two.ts": P(),
      "src/domains/a/plugs/ranked/late.ts": P("export const order = 2;\n"),
      "src/domains/b/plugs/ranked/early.ts": P("export const order = 1;\n"),
      "src/domains/b/plugs/ranked/none.ts": P(),
      "src/domains/a/plugs/kinds/x.ts": P(),
      "src/domains/b/plugs/kinds/y.ts": P(),
      "src/domains/b/plugs/unknownPoint/z.ts": P(),
      "src/domains/b/plugs/kinds/noExport.ts": "export const other = 1;\n",
    }),
  );
  const find = (s) => plan.problems.find((p) => p.includes(s)) ?? "";
  assert.match(find("routeFactoryDevice の項目は 1 個まで"), /src\/domains\/a\/plugs\/routeFactoryDevice\/one\.ts・src\/domains\/b\/plugs\/routeFactoryDevice\/two\.ts/);
  assert.match(find("ranked/none.ts"), /export const order = <数> が無い/);
  assert.match(find('kind "k"'), /src\/domains\/b\/plugs\/kinds\/y\.ts: .*src\/domains\/a\/plugs\/kinds\/x\.ts とぶつかる/);
  assert.match(find("unknownPoint"), /plugs の点 unknownPoint が無い/);
  assert.match(find("plugs の点 kinds は"), /にもある/);
  assert.match(find("noExport.ts"), /export const plug が無い/);
  assert.equal(plan.problems.length, 6, plan.problems.join("\n"));
  const ranked = plan.outputs["src/lib/routeFactory/extensions/ranked.ts"].split("\n").filter((l) => l.startsWith("  { domain")).map((l) => /name: "(\w+)"/.exec(l)[1]);
  assert.deepEqual(ranked, ["none", "early", "late"], "order の無い項目は 0、同じ順位は <差す側>/<名前>");
});

test("結び目 wire(D31): lib の宣言の export const wire から src/wiring/<lib>.ts に一覧と結び目を書く。server は門番で絞って作り手に渡し(shape object の点だけなら <点>Map を型引数に、注文 34)、client は子を包む部品と登録名の型、宣言の誤りは止める", () => {
  const plan = planExtensions(
    fixture({
      "src/lib/report/extensionPoints.ts": `${point(`  reportSinks: { change: "add", plugs: true, export: "sink", type: { from: "@/lib/report/points", name: "Sink" }, side: "server", load: "lazy", target: "wiring" },`)}export const wire = { name: "wireReport", export: "report", side: "server" };\n`,
      "src/lib/inputKit/extensionPoints.ts": `${point(`  kitInputs: { change: "add", plugs: true, export: "input", type: { from: "@/lib/inputKit/points", name: "KitInput" }, side: "client", key: "name", target: "wiring" },`)}export const wire = { name: "KitProvider", export: "KitRoot", side: "client", registers: "RegisteredKitInputs" };\n`,
      "src/domains/acme/plugs/kitInputs/rates.ts": 'export const input = { name: "ticketRates", load: () => import("./x") };\n',
      "src/lib/kitExtras/plugs/kitInputs/color.ts": 'export const input = { name: "color", load: () => import("./y") };\n',
    }),
  );
  assert.deepEqual(plan.problems, []);
  const server = plan.outputs["src/wiring/report.ts"];
  assert.match(server, /^import \{ gate \} from "@\/featureGate";$/m);
  assert.match(server, /^import \{ wireReport \} from "@\/lib\/report";$/m);
  assert.match(server, /^export const report = wireReport\(\{ reportSinks: gate\.plugs\(reportSinks\) \}\);$/m);
  const client = plan.outputs["src/wiring/inputKit.ts"];
  assert.match(client, /^"use client";$/m);
  assert.ok(client.indexOf('"use client";') < client.indexOf("import "), "use client は import より前");
  assert.match(client, /interface RegisteredKitInputs extends Record<"color" \| "ticketRates", true> \{\}/);
  assert.match(client, /declare module "@\/lib\/inputKit" \{/);
  assert.match(client, /export function KitRoot\(\{ children \}: Readonly<\{ children: ReactNode \}>\) \{\n  const gate = useGate\(\);\n  return createElement\(KitProvider, \{ kitInputs: gate\.plugs\(kitInputs\) \}, children\);\n\}/);

  const read = (wire) => readDeclaration("src/lib/x/extensionPoints.ts", `${point("")}export const wire = ${wire};\n`).problems;
  assert.match(read('{ name: "f", export: "x", side: "shared" }')[0], /side は server \| client/);
  assert.match(read('{ name: "f", export: "x", side: "server", registers: "R" }')[0], /registers は client の結び目だけ/);
  assert.match(read('{ name: "f", side: "server", extra: 1 }').join("\n"), /未知のキー extra[\s\S]*export は/);
  const typed = planExtensions(
    fixture({
      "src/lib/guardKit/extensionPoints.ts": `${point(`  guardUser: { change: "add", plugs: true, export: "plug", type: { from: "@/lib/guardKit", name: "AnyGuardUser" }, side: "server", shape: "object", max: 1, required: true, target: "wiring" },`)}export const wire = { name: "wireGuard", export: "defineGuard", side: "server" };\n`,
      "src/domains/acme/extensionPoints.ts": "export const alwaysOpen = true;\n",
      "src/domains/acme/plugs/guardUser/session.ts": "export const plug = { deps: {} };\n",
    }),
  );
  assert.deepEqual(typed.problems, []);
  assert.match(typed.outputs["src/wiring/guardKit.ts"], /^export const defineGuard = wireGuard<GuardUserMap>\(\{ guardUser: gate\.plugs\(guardUser\) \}\);$/m, "shape object の点だけの結び目は <点>Map を型引数で渡す");
  const lonely = planExtensions(fixture({ "src/lib/lonely/extensionPoints.ts": `${point(`  things: { change: "add", dir: "things", export: "thing", type: { from: "@/x", name: "T" }, side: "server" },`)}export const wire = { name: "f", export: "x", side: "server" };\n` }));
  assert.ok(lonely.problems.some((p) => p.includes('wire は target "wiring" の plugs の点と一緒に')), lonely.problems.join("\n"));
});

test("plugs の点の欄(注文 25): overrideOf は隣の .override.ts を重ねる・files と itemsOf は同じ項目のフォルダの別のファイル・shape object は名前の Map と型・literalKeys は鍵の型・alwaysOn は門番で外さない旨", () => {
  const X = (extra = "") => `export const item = { key: "k1"${extra} };\n`;
  const plan = planExtensions(
    fixture({
      "src/domains/core/messaging/extensionPoints.ts": point(
        [
          `  messagingLayouts: { change: "add", plugs: true, files: "*/layout.ts", export: "layout", type: { from: "@/x", name: "L" }, side: "server", key: "key", overrideOf: ["disabled"] },`,
          `  messagingLayoutInApps: { change: "add", plugs: true, itemsOf: "messagingLayouts", files: "*/inApp.tsx", export: "inAppRenderer", type: { from: "@/x", name: "I" }, side: "client" },`,
          `  messagingFields: { change: "add", plugs: true, export: "field", type: { from: "@/x", name: "F" }, side: "shared", shape: "object" },`,
          `  messagingKinds: { change: "add", plugs: true, export: "item", type: { from: "@/x", name: "K" }, side: "server", key: "key", literalKeys: true },`,
          `  messagingCleanups: { change: "add", plugs: true, export: "item", type: { from: "@/x", name: "C" }, side: "server", alwaysOn: true },`,
        ].join("\n"),
      ),
      "src/domains/core/messaging/plugs/messagingLayouts/alert/layout.ts": 'export const layout = { key: "alert" };\n',
      "src/domains/core/messaging/plugs/messagingLayouts/alert/layout.override.ts": "export const override = { disabled: true };\n",
      "src/domains/core/messaging/plugs/messagingLayouts/alert/inApp.tsx": 'export const inAppRenderer = { layout: "alert" };\n',
      "src/domains/core/wallet/plugs/messagingLayouts/statement/layout.ts": 'export const layout = { key: "statement" };\n',
      "src/domains/core/wallet/plugs/messagingFields/limit.ts": "export const field = 1;\n",
      "src/domains/core/user/plugs/messagingFields/limit.ts": "export const field = 2;\n",
      "src/domains/core/wallet/plugs/messagingKinds/b.ts": X().replace("k1", "beta"),
      "src/domains/core/user/plugs/messagingKinds/a.ts": X().replace("k1", "alpha"),
      "src/domains/core/user/plugs/messagingCleanups/wallet.ts": "export const item = 1;\n",
    }),
  );
  assert.deepEqual(plan.problems.map((p) => p.replace(/^.*?: /, "")), ["点 messagingFields の項目の名前 limit は src/domains/core/user/plugs/messagingFields/limit.ts とぶつかる(名前が鍵なので全体で一意)"]);
  const layouts = plan.outputs["src/domains/core/messaging/extensions/messagingLayouts.ts"];
  assert.match(layouts, /\{ domain: "messaging", name: "alert", requires: \[\], plug: \{ \.\.\.messagingLayouts_messaging_alert, \.\.\.messagingLayouts_messaging_alert_override, folder: "alert" \} \}/);
  assert.match(layouts, /import \{ override as messagingLayouts_messaging_alert_override \} from "@\/domains\/core\/messaging\/plugs\/messagingLayouts\/alert\/layout\.override";/);
  assert.match(layouts, /plug: L & \{ folder: string \}/);
  assert.match(layouts, /\{ domain: "wallet", name: "statement"/);
  assert.match(layouts, /隣の <名前>\.override\.ts の disabled を重ねる/);
  const inApps = plan.outputs["src/domains/core/messaging/extensions/messagingLayoutInApps.ts"];
  assert.match(inApps, /plugs\/messagingLayouts\/\*\/inApp\.tsx/, "itemsOf の点は主の点のフォルダを読む");
  assert.match(inApps, /\{ domain: "messaging", name: "alert", requires: \[\], plug: \{ \.\.\.messagingLayoutInApps_messaging_alert, folder: "alert" \} \}/);
  assert.doesNotMatch(inApps, /statement/, "ファイルの無いフォルダは項目でない");
  const kinds = plan.outputs["src/domains/core/messaging/extensions/messagingKinds.ts"];
  assert.match(kinds, /export type MessagingKindsKey = "alpha" \| "beta";/);
  const fields = plan.outputs["src/domains/core/messaging/extensions/messagingFields.ts"];
  assert.match(fields, /export type MessagingFieldsMap = typeof messagingFieldsMap;/);
  assert.match(fields, /plug: messagingFieldsMap\.limit \}/);
  assert.match(plan.outputs["src/domains/core/messaging/extensions/messagingCleanups.ts"], /常に読む: gate\.plugs を掛けず項目の enabled で閉じる/);
  const rows = intakeRowsOf({ points: plan.points });
  assert.ok(rows.includes("add src/domains/**/plugs/messagingLayouts/*/layout.override.{ts,tsx}  # 上書き messagingLayouts(disabled)の上流の項目の隣"), rows.join("\n"));
  assert.ok(!rows.some((r) => r.includes("messagingKinds")), "上書きの無い plugs の点は行を出さない");
});

test("plugs の点: 空の一覧は [](空なら点の持ち主の既定で動く、D53)、intake.txt の行は出さない、地図の forkCan は自分のドメインの plugs/<点>/*", () => {
  const files = {
    "src/lib/routeFactory/extensionPoints.ts": point(`  routeFactoryDevice: { change: "add", plugs: true, export: "plug", type: { from: "@/x", name: "D" }, side: "server", max: 1 },`),
    "src/lib/forkOwnership/intake.txt": "# === AUTO-GENERATED intake START ===\n# === AUTO-GENERATED intake END ===\n",
  };
  const root = fixture(files);
  const plan = planExtensions(root);
  assert.deepEqual(plan.problems, []);
  assert.match(plan.outputs["src/lib/routeFactory/extensions/routeFactoryDevice.ts"], /export const routeFactoryDevice: .*\[\] = \[\];/);
  assert.ok(!plan.intake.content.includes("routeFactoryDevice"));
  const lib = readDistrictMapAt(root).districts.find((d) => d.kind === "lib" && d.name === "routeFactory");
  assert.deepEqual(lib?.forkCan.find((f) => f.point === "routeFactoryDevice"), { point: "routeFactoryDevice", change: "add", where: "src/domains/<自分のドメイン>/plugs/routeFactoryDevice/*" });
});

test("plugs の点の required(ちょうど 1 つ、D53・注文 30・35): 0 個は止める・埋めるのは常設のドメインか lib だけ。上流の項目は 1 行スイッチ(<名前>.ts → <名前>.default.ts)で、export は既定から読み、.default・.replace は項目にしない。required は plugs の max: 1 だけ", () => {
  const decl = `  routeUser: { change: "add", plugs: true, export: "plug", type: { from: "@/x", name: "U" }, side: "server", shape: "object", max: 1, required: true, target: "wiring" },`;
  const empty = planExtensions(fixture({ "src/lib/routeFactory/extensionPoints.ts": point(decl) }));
  assert.equal(empty.problems.length, 1, empty.problems.join("\n"));
  assert.match(empty.problems[0], /点 routeUser は項目がちょうど 1 つ要る/);
  const plan = planExtensions(
    fixture({
      "src/lib/routeFactory/extensionPoints.ts": point(decl),
      "src/domains/auth/extensionPoints.ts": `${point(`  authRouteUser: { change: "replace", default: "src/domains/auth/plugs/routeUser/session.default.ts", type: { from: "@/x", name: "U" }, side: "server" },`)}export const alwaysOpen = true;\n`,
      "src/domains/auth/plugs/routeUser/session.ts": 'export { plug } from "./session.default";\n',
      "src/domains/auth/plugs/routeUser/session.default.ts": "export const plug = { deps: {} };\n",
      "src/domains/auth/plugs/routeUser/session.replace.ts": "export const plug = { deps: { fork: true } };\n",
    }),
  );
  assert.deepEqual(plan.problems, []);
  const out = plan.outputs["src/wiring/routeFactory.ts"];
  assert.match(out, /import \{ plug as routeUser_auth_session \} from "@\/domains\/auth\/plugs\/routeUser\/session";/);
  assert.equal(out.match(/^  \{ domain/gm)?.length, 1, "項目はスイッチの 1 つだけ(.default・.replace は項目にしない)");
  // 埋めるのは常設のドメイン(alwaysOpen)か lib だけ(D53、注文 35): 常設の宣言の無いドメインの項目は止める
  const gated = planExtensions(
    fixture({
      "src/lib/routeFactory/extensionPoints.ts": point(decl),
      "src/domains/wallet/plugs/routeUser/session.ts": "export const plug = { deps: {} };\n",
    }),
  );
  assert.equal(gated.problems.length, 1, gated.problems.join("\n"));
  assert.match(gated.problems[0], /src\/domains\/wallet\/plugs\/routeUser\/session\.ts: 点 routeUser はちょうど 1 つ要る点\(required\)。埋められるのは常設のドメイン/);
  const fromLib = planExtensions(fixture({ "src/lib/routeFactory/extensionPoints.ts": point(decl), "src/lib/authKit/plugs/routeUser/session.ts": "export const plug = { deps: {} };\n" }));
  assert.deepEqual(fromLib.problems, [], "lib の項目は閉じないので埋めてよい");
  const read = (body) => readDeclaration("x/extensionPoints.ts", point(body)).problems;
  assert.match(read(`  p: { change: "add", plugs: true, export: "plug", type: { from: "@/x", name: "U" }, side: "server", required: true },`).join("\n"), /required は plugs で max: 1 の点に true だけ/);
  assert.match(read(`  p: { change: "add", plugs: true, export: "plug", type: { from: "@/x", name: "U" }, side: "server", max: 1, required: false },`).join("\n"), /required は plugs で max: 1 の点に true だけ/);
});

test("plugs の点の stages(段の閉じた並び、D30・注文 31): 段の並び → <差す側>/<名前>、項目に stage が付く。段の無い項目・知らない段・骨組みの段は止める。宣言の誤りも止める", () => {
  const decl = `  chain: { change: "add", plugs: true, export: "handler", type: { from: "@/x", name: "H" }, side: "server", stages: ["first", "gate", "main"], skeletonStages: ["gate"] },`;
  const H = (stage) => `export const stage = "${stage}";\nexport const handler = () => {};\n`;
  const plan = planExtensions(
    fixture({
      "src/proxies/extensionPoints.ts": point(decl),
      "src/domains/a/plugs/chain/late.ts": H("main"),
      "src/domains/b/plugs/chain/early.ts": H("first"),
      "src/domains/a/plugs/chain/alsoFirst.ts": H("first"),
    }),
  );
  assert.deepEqual(plan.problems, []);
  const out = plan.outputs["src/proxies/extensions/chain.ts"];
  const rows = out.split("\n").filter((l) => l.startsWith("  { domain"));
  assert.deepEqual(rows.map((l) => /name: "(\w+)"/.exec(l)[1]), ["alsoFirst", "early", "late"]);
  assert.match(rows[0], /stage: "first"/);
  assert.match(out, /stage: "first" \| "gate" \| "main";/);
  const bad = planExtensions(
    fixture({
      "src/proxies/extensionPoints.ts": point(decl),
      "src/domains/a/plugs/chain/none.ts": "export const handler = () => {};\n",
      "src/domains/a/plugs/chain/unknown.ts": H("later"),
      "src/domains/a/plugs/chain/skeleton.ts": H("gate"),
    }),
  ).problems.join("\n");
  assert.match(bad, /none\.ts: export const stage = "<段>" が無い/);
  assert.match(bad, /unknown\.ts: 段 later は点 chain に無い/);
  assert.match(bad, /skeleton\.ts: 段 gate は点の持ち主の骨組みだけが使う/);
  const read = (body) => readDeclaration("x/extensionPoints.ts", point(body)).problems.join("\n");
  assert.match(read(`  p: { change: "add", plugs: true, export: "h", type: { from: "@/x", name: "H" }, side: "server", stages: ["only"] },`), /stages は plugs の点の段の名前/);
  assert.match(read(`  p: { change: "add", plugs: true, export: "h", type: { from: "@/x", name: "H" }, side: "server", stages: ["a", "b"], skeletonStages: ["a", "b"] },`), /skeletonStages は stages の中の名前/);
});

test("古い枠の置き場(注文 32): src/app/_providers と src/app/_layout/adminCommand が残っていれば移す先を出して止める", () => {
  const problems = planExtensions(
    fixture({
      "src/app/_providers/ForkProviders.replace.tsx": "export function ForkProviders() {}\n",
      "src/app/_layout/adminCommand/categories/points.tsx": "export const category = {};\n",
    }),
  ).problems.join("\n");
  assert.match(problems, /src\/app\/_providers\/: fork の Provider の古い口.*plugs\/rootProviders/);
  assert.match(problems, /src\/app\/_layout\/adminCommand\/: 管理者コマンドの点の古い置き場.*plugs\/adminCommandCategories/);
});

test("型だけの入口(D33・注文 37): ドメインでない持ち主の点の type.from は @/<持ち主>/points だけ。ドメインの点・型の無い点は問わない", () => {
  const P = (owner, name, from) => ({ owner, name, declaredIn: `${owner}/extensionPoints.ts`, spec: from === null ? { change: "add" } : { change: "add", type: { from, name: "T" } } });
  const problems = pointsEntryProblems([
    P("src/lib/kit", "kitItems", "@/lib/kit"),
    P("src/lib/kit", "kitOk", "@/lib/kit/points"),
    P("src/app/admin/_layout", "overlays", "@/app/_layout/points"),
    P("src/proxies", "proxyThings", "@/proxies/points"),
    P("src/domains/acme", "acmeItems", "@/domains/acme/types"),
    P("src/lib/plain", "plainItems", null),
  ]);
  assert.equal(problems.length, 2, problems.join("\n"));
  assert.match(problems[0], /src\/lib\/kit\/extensionPoints\.ts: kitItems: 約束の型は持ち主の型だけの入口から出す\(type\.from は "@\/lib\/kit\/points"、今 "@\/lib\/kit"/);
  assert.match(problems[1], /overlays: .*"@\/app\/admin\/_layout\/points"/, "枠も自分の入口(よその枠の型は自分の points.ts で出し直す)");
});

test("消した例外の受け口(注文 36): src/featureGate/alwaysOnExceptions・dependencyExceptions と旧い scripts/proxies の置き場が残っていれば代わりのやり方を出して止める", () => {
  const problems = planExtensions(
    fixture({
      "src/featureGate/alwaysOnExceptions/wire.ts": 'export const exception = { file: "src/wiring/x.ts", reason: "r" };\n',
      "src/featureGate/dependencyExceptions/lazy.ts": 'export const exception = { file: "src/x.ts", reason: "r" };\n',
      "scripts/proxies/alwaysOnExceptions.acme.mjs": "export default {};\n",
    }),
  ).problems.join("\n");
  assert.match(problems, /src\/featureGate\/alwaysOnExceptions\/: 常時実行の入口の例外の受け口は無くなった.*点の項目/);
  assert.match(problems, /src\/featureGate\/dependencyExceptions\/: 依存の検査の例外の受け口は無くなった.*requires/);
  assert.match(problems, /scripts\/proxies\/alwaysOnExceptions\.acme\.mjs: 常時実行の入口の例外の旧い置き場/);
});

test("override: 上流(Tier1)は 1 本も出荷しない(空も)。fork は空も中身ありも通る。cron は task.ts の隣の task.override.ts。素の override.ts は override ではない(孤立は orphans.mjs)", () => {
  const root = fixture({
    "src/domains/core/user/services/server/domainEntry.ts": "export const domainEntry = {};\n",
    "src/domains/core/x/thing.tsx": "export const x = 1;\n",
    "src/domains/core/user/coreRoles/user.role.json": "{}\n",
    "src/domains/core/userProfile/profiles/user.profile.json": "{}\n",
    "src/app/api/cron/wallet-expire/task.ts": "export const cronTask = {};\n",
    "src/app/api/cron/wallet-expire/task.override.ts": "export const cronOverride = { disabled: true };\n",
    "src/app/api/cron/other/task.override.ts": "// 親の上書きを外す\n",
    "src/app/api/cron/legacy/override.ts": "export const cronOverride = { disabled: true };\n",
    "src/domains/core/user/services/server/domainEntry.override.ts": "export const domainEntryOverrides = {};\n",
    "src/domains/core/x/thing.override.tsx": "export const x = 1;\n",
    "src/domains/core/user/coreRoles/user.role.override.ts": "export const override = {};\n",
    "src/domains/core/userProfile/profiles/user.profile.override.ts": "export const override = {};\n",
    "src/domains/core/x/override.ts": "export const notAnOverride = 1;\n",
  });
  const fork = checkOverrides(root, { isTier1: false });
  assert.deepEqual(fork.problems, []);
  assert.deepEqual(
    fork.overrides.map((o) => `${o.path}:${o.blank}`),
    [
      "src/app/api/cron/other/task.override.ts:true",
      "src/app/api/cron/wallet-expire/task.override.ts:false",
      "src/domains/core/user/coreRoles/user.role.override.ts:false",
      "src/domains/core/user/services/server/domainEntry.override.ts:false",
      "src/domains/core/userProfile/profiles/user.profile.override.ts:false",
      "src/domains/core/x/thing.override.tsx:false",
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
    put("repo.json", '{"repo_id": "next-starter", "tier": "root"}\n');
    put("src/lib/CATALOG.md", "## next-starter\n");
    put("src/app/demo/extensionPoints.ts", 'export const extensionPoints = { pages: { change: "add", dir: ".", files: "*/_demo.ts", export: "demo", type: { from: "@/t", name: "T" }, side: "shared" } };\n');
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

test("files の点の override(overrideOf): 項目のファイルの隣の <ファイル名>.override.ts を重ね、宣言に無い鍵・項目の無いフォルダ・overrideOf の無い点は止める、intake は add の行", () => {
  const root = mkdtempSync(join(tmpdir(), "ext-files-override-"));
  const put = (path, text) => {
    mkdirSync(dirname(join(root, path)), { recursive: true });
    writeFileSync(join(root, path), text);
  };
  const decl = (extra) => `export const extensionPoints = { pages: { change: "add", dir: ".", files: "*/_demo.ts", export: "demo", type: { from: "@/t", name: "T" }, side: "shared"${extra} } };\n`;
  try {
    // fork(上流は override を出荷しない)
    put("repo.json", '{"repo_id": "fork-a", "tier": "leaf"}\n');
    put("src/lib/CATALOG.md", "## next-starter\n\n## fork-a\n");
    put("src/app/demo/extensionPoints.ts", decl(', overrideOf: ["disabled"]'));
    put("src/app/demo/a-page/_demo.ts", "export const demo = {};\n");
    put("src/app/demo/a-page/_demo.override.ts", "export const override = { disabled: true };\n");
    let plan = planExtensions(root);
    assert.deepEqual(plan.problems, [], plan.problems.join("\n"));
    const out = plan.outputs["src/app/demo/extensions/pages.ts"];
    assert.match(out, /import \{ override as pages_a_page_override \} from "@\/app\/demo\/a-page\/_demo\.override";/);
    assert.match(out, /\{ \.\.\.pages_a_page, \.\.\.pages_a_page_override, folder: "a-page" \}/);
    assert.match(out, /隣の _demo\.override\.ts の disabled を重ねる/);

    put("src/app/demo/a-page/_demo.override.ts", "export const override = { key: \"x\" };\n");
    plan = planExtensions(root);
    assert.ok(plan.problems.some((p) => p.includes("_demo.override.ts: key は上書きできない")), plan.problems.join("\n"));

    put("src/app/demo/a-page/_demo.override.ts", "export const override = { disabled: true };\n");
    put("src/app/demo/gone/_demo.override.ts", "export const override = { disabled: true };\n");
    plan = planExtensions(root);
    assert.ok(plan.problems.some((p) => p.includes("gone/_demo.override.ts: 項目 gone/_demo.ts が無い")), plan.problems.join("\n"));
    rmSync(join(root, "src/app/demo/gone"), { recursive: true, force: true });

    // overrideOf の無い点: 項目のフォルダの override は受ける点が無い(孤立の検査)
    put("src/app/demo/extensionPoints.ts", decl(""));
    plan = planExtensions(root);
    assert.ok(plan.problems.some((p) => p.startsWith("src/app/demo/a-page/_demo.override.ts: この上書きを受ける点が無い")), plan.problems.join("\n"));
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
    put("repo.json", '{"repo_id": "next-starter", "tier": "root"}\n');
    put("src/lib/CATALOG.md", "## next-starter\n");
    put("src/domains/x/extensionPoints.ts", 'export const extensionPoints = { rules: { change: "add", dir: "rules", export: "rule", type: { from: "@/t", name: "T" }, side: "server", key: "k" } };\n');
    put("src/domains/x/rules/a.ts", 'export const rule = { k: "a" };\n');
    const out = planExtensions(root).outputs["src/domains/x/extensions/rules.ts"];
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

const SETTING_POINTS = point(`  fields: { change: "add", dir: "fields", export: "field", type: { from: "@/t", name: "F" }, side: "shared", shape: "object", pureImports: true, requireText: ".default(", overrideOf: ["ui", "public"], derive: "settingSections" },
  sections: { change: "add", dir: "sections", export: "section", type: { from: "@/t", name: "S" }, side: "client", key: "key", overrideOf: ["label"] },`);
const KEY = 'import { z } from "zod";\nexport const field = { schema: z.number().default(1), ui: { section: "general" } };\n';
const SECTION = 'export const section = { key: "general", label: "x", order: 1 };\n';
const settingPlan = (extra) =>
  planExtensions(fixture({
    "tsconfig.json": JSON.stringify({ compilerOptions: { baseUrl: ".", paths: { "@/*": ["./src/*"] } } }),
    "src/domains/core/setting/extensionPoints.ts": SETTING_POINTS,
    "src/domains/core/setting/sections/general.ts": SECTION,
    "src/domains/core/setting/fields/a.ts": KEY,
    ...extra,
  }));
const hasProblem = (plan, text) => assert.ok(plan.problems.some((p) => p.includes(text)), `${text} が無い: ${plan.problems.join(" / ")}`);

test("setting の点: shape object はキーを型に残し、足したキーも並び、null プロトタイプ", () => {
  const plan = settingPlan({ "src/domains/core/setting/fields/b.ts": KEY });
  assert.deepEqual(plan.problems, []);
  const out = plan.outputs["src/domains/core/setting/extensions/fields.ts"];
  assert.match(out, /const fieldsMap = \{\n {2}a: fields_a,\n {2}b: fields_b,\n\} as const satisfies Readonly<Record<string, F>>;/);
  assert.match(out, /export const fields = Object\.assign\(Object\.create\(null\), fieldsMap\) as typeof fieldsMap;/);
});

test("setting の点: 失敗の形(.default なし・同名・無いセクション・セクションの重複)", () => {
  hasProblem(settingPlan({ "src/domains/core/setting/fields/n.ts": 'export const field = { schema: 1 };\n' }), ".default( が無い");
  hasProblem(settingPlan({ "src/domains/core/setting/fields/a.acme.ts": KEY }), "印なしの a.ts に改名");
  hasProblem(settingPlan({ "src/domains/core/setting/fields/a/index.ts": KEY }), "同じ名前の項目");
  hasProblem(settingPlan({ "src/domains/core/setting/fields/x.ts": KEY.replace("general", "nope") }), '無いセクション "nope"');
  hasProblem(settingPlan({ "src/domains/core/setting/sections/other.ts": SECTION }), 'セクションの key "general"');
});

test("setting の点: キーから推移的に届く値 import を止める、型だけと config と純関数は通す", () => {
  const f = "src/domains/core/setting/fields/";
  const key = (imp) => `${imp}\nexport const field = { schema: z.number().default(1) };\n`;
  hasProblem(settingPlan({ [`${f}r.ts`]: key('import React from "react";') }), "react");
  hasProblem(settingPlan({ [`${f}s.ts`]: key('import "server-only";') }), "server-only");
  hasProblem(settingPlan({ [`${f}d.ts`]: key('import { x } from "@/domains/foo/services/server/x";'), "src/domains/foo/services/server/x.ts": "export const x = 1;\n" }), "services/server/x.ts");
  const deep = settingPlan({
    [`${f}t.ts`]: key('import { y } from "@/config/app/y";'),
    "src/config/app/y.ts": 'import { w } from "@/utils/w";\nexport const y = w;\n',
    "src/utils/w.ts": 'import "server-only";\nexport const w = 1;\n',
  });
  hasProblem(deep, "server-only");
  const fine = settingPlan({
    [`${f}o.ts`]: key('import type { T } from "@/domains/foo/services/server/t";\nimport { y } from "@/config/app/y";'),
    "src/config/app/y.ts": "export const y = 1;\n",
  });
  assert.deepEqual(fine.problems, []);
});

test("setting の点: override は許す属性だけ、既存の項目だけ、一覧に重なる、空は不在", () => {
  const f = "src/domains/core/setting/fields/";
  const ok = settingPlan({ [`${f}a.override.ts`]: 'export const override = { public: true };\n' });
  assert.deepEqual(ok.problems, []);
  assert.match(ok.outputs["src/domains/core/setting/extensions/fields.ts"], /a: \{ \.\.\.fields_a, \.\.\.fields_a_override \},/);
  hasProblem(settingPlan({ [`${f}a.override.ts`]: 'export const override = { schema: 1 };\n' }), "schema は上書きできない");
  hasProblem(settingPlan({ [`${f}nope.override.ts`]: 'export const override = { public: true };\n' }), "項目 nope が無い");
  // 「上流の項目だけ」は名前では見分けない(所有の側の検査、指令 02)。足した項目への override もここでは通る
  assert.deepEqual(settingPlan({ [`${f}b.ts`]: KEY, [`${f}b.override.ts`]: 'export const override = { public: true };\n' }).problems, []);
  const blank = settingPlan({ [`${f}a.override.ts`]: "// 空\n" });
  assert.deepEqual(blank.problems, []);
  assert.doesNotMatch(blank.outputs["src/domains/core/setting/extensions/fields.ts"], /fields_a_override/);
  const sec = settingPlan({ "src/domains/core/setting/sections/general.override.ts": 'export const override = { label: "y" };\n' });
  assert.deepEqual(sec.problems, []);
  assert.match(sec.outputs["src/domains/core/setting/extensions/sections.ts"], /\{ \.\.\.sections_general, \.\.\.sections_general_override \},/);
});

test("writer の点: 別の生成器が書く一覧。持てるのは side だけ、ほかのキー・未知の writer は失敗", () => {
  const read = (body) => readDeclaration("x/extensionPoints.ts", `export const extensionPoints = { roles: ${body} };`);
  assert.deepEqual(read('{ change: "add", writer: "role:generate", side: "shared" }').problems, []);
  assert.equal(read('{ change: "add", writer: "other", side: "shared" }').problems.length, 1);
  assert.equal(read('{ change: "add", writer: "role:generate", side: "shared", dir: "roles" }').problems.length, 1);
});

// setting の上書きは権限を絞るだけ(derive/settingRoles.mjs)。上流 = 項目のファイル、上書き = 隣の .override.ts
const ROLE_POINTS = point(`  fields: { change: "add", dir: "fields", export: "field", type: { from: "@/t", name: "F" }, side: "shared", shape: "object", pureImports: true, requireText: ".default(", overrideOf: ["ui", "public", "default", "allowRoles"], derive: "settingSections" },
  sections: { change: "add", dir: "sections", export: "section", type: { from: "@/t", name: "S" }, side: "client", key: "key", overrideOf: ["label", "order", "icon", "allowRoles", "description", "groups"] },`);
const roleField = (props) => `import { z } from "zod";\nexport const field = { schema: z.number().default(1), ${props} };\n`;
const roleSection = (key, props = "") => `export const section = { key: "${key}", label: "x", order: 1${props ? `, ${props}` : ""} };\n`;
const S = "src/domains/core/setting/sections/";
const F = "src/domains/core/setting/fields/";
const rolePlan = (files) =>
  planExtensions(fixture({
    "tsconfig.json": JSON.stringify({ compilerOptions: { baseUrl: ".", paths: { "@/*": ["./src/*"] } } }),
    "src/domains/core/setting/extensionPoints.ts": ROLE_POINTS,
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

test("fork の今の受け口の override(oripa-do の 8 本: 管理メニューのカテゴリー 3・項目 4・設定のセクション 1)が実リポの宣言で通る(鍵の集合は変えない、段 3 で項目は差す側の plugs/<点>/ へ)", () => {
  const declaration = (path) => readFileSync(join(repoRoot, path), "utf8");
  const item = (exportName, key) => `export const ${exportName} = { key: "${key}" };\n`;
  const files = {
    "src/domains/core/admin/extensionPoints.ts": declaration("src/domains/core/admin/extensionPoints.ts"),
    "src/domains/core/setting/extensionPoints.ts": declaration("src/domains/core/setting/extensionPoints.ts"),
    "src/domains/core/setting/plugs/settingSections/maintenance.ts": item("section", "maintenance"),
    "src/domains/core/setting/plugs/settingSections/maintenance.override.ts": 'import type { SettingSectionOverride } from "@/domains/core/setting/types/definition";\n\nexport const override: SettingSectionOverride = { order: 30 };\n',
  };
  const categories = { users: '{ allowRoles: ["admin"] }', system: '{ label: "システム設定" }', data: "{ hidden: true }" };
  // 項目の持ち主(差す側): users のカテゴリーは user、ほかは admin
  for (const [name, body] of Object.entries(categories)) {
    const dir = `src/domains/core/${name === "users" ? "user" : "admin"}/plugs/adminMenuCategories`;
    files[`${dir}/${name}.ts`] = item("category", name);
    files[`${dir}/${name}.override.ts`] = `import type { AdminMenuCategoryOverride } from "@/domains/core/admin/menu/types";\n\nexport const override = ${body} satisfies AdminMenuCategoryOverride;\n`;
  }
  const items = { usersGeneral: ["User", "{ icon: User }"], usersSystem: ["Shield", "{ icon: Shield }"], usersDemo: ["UserCircle", "{ icon: UserCircle }"], notificationTemplates: [null, "{ hidden: true }"] };
  // 項目の持ち主(差す側): users* は user、通知のテンプレートは messaging
  for (const [name, [icon, body]] of Object.entries(items)) {
    const dir = `src/domains/core/${name.startsWith("users") ? "user" : "messaging"}/plugs/adminMenuItems`;
    files[`${dir}/${name}.ts`] = item("item", name);
    const iconImport = icon ? `import { ${icon} } from "lucide-react";\n\n` : "";
    files[`${dir}/${name}.override.ts`] = `${iconImport}import type { AdminMenuItemOverride } from "@/domains/core/admin/menu/types";\n\nexport const override = ${body} satisfies AdminMenuItemOverride;\n`;
  }
  const plan = planExtensions(fixture(files));
  assert.deepEqual(plan.problems.filter((p) => p.includes(".override.ts")), []);
  const overridden = [...plan.itemsByPoint.values()].flat().filter((i) => i.override).map((i) => i.name).sort();
  assert.deepEqual(overridden, ["data", "maintenance", "notificationTemplates", "system", "users", "usersDemo", "usersGeneral", "usersSystem"]);
});

test("宣言: overrides の点(受け口でない上書きの対象)は overrides・side・overrideOf・addable だけ。受け口の一覧にならず、intake は .override の edit の行と addable の add の行", () => {
  const read = (body) => readDeclaration("x/extensionPoints.ts", point(body));
  const OK = `  cronTasks: { change: "override", overrides: "src/app/api/cron/*/task.ts", export: "override", side: "server", overrideOf: ["schedule", "disabled"] },`;
  assert.deepEqual(read(OK).problems, []);
  assert.match(read(`  cronTasks: { change: "override", overrides: "src/a/*.ts", export: "override", side: "server" },`).problems[0], /overrideOf .*必須/);
  assert.match(read(`  cronTasks: { change: "override", overrides: "src/a/*.ts", export: "override", side: "server", overrideOf: ["a"], dir: "a" },`).problems[0], /overrides の点に dir は書けない/);
  assert.match(read(`  cronTasks: { change: "override", overrides: "src/a/*.ts", export: "override", side: "server", overrideOf: ["a"], writer: "role:generate" },`).problems[0], /overrides の点に writer は書けない/);
  assert.match(read(`  cronTasks: { change: "override", overrides: "../a/*.ts", export: "override", side: "server", overrideOf: ["a"] },`).problems[0], /overrides は対象のファイル/);
  assert.match(read(`  cronTasks: { change: "override", overrides: "src/../a.ts", export: "override", side: "server", overrideOf: ["a"] },`).problems[0], /overrides は対象のファイル/);
  assert.match(read(`  cronTasks: { change: "override", overrides: "src/a.ts", export: "override", side: "edge", overrideOf: ["a"] },`).problems[0], /side は/);
  const files = { "src/lib/cron/extensionPoints.ts": point(OK), "src/domains/milestone/extensionPoints.ts": point(MILESTONES), "src/lib/forkOwnership/intake.txt": "# === AUTO-GENERATED intake START ===\n# === AUTO-GENERATED intake END ===\n" };
  const plan = planExtensions(fixture(files));
  assert.deepEqual(plan.problems, []);
  assert.deepEqual(Object.keys(plan.outputs), ["src/domains/milestone/extensions/definitions.ts"]);
  const rowsOf = (content) => content.split("\n").filter((l) => /^(add|edit) /.test(l)).map((l) => l.split("  #")[0]);
  assert.ok(rowsOf(plan.intake.content).includes("edit src/app/api/cron/*/task.override.ts"), "上書きの対象の点 = 隣の .override.ts の edit の行");
  assert.ok(!rowsOf(plan.intake.content).includes("add src/app/api/cron/*/task.ts"), "addable の無い点は対象を足す add の行を作らない");
  const ROLES = `  roleDefinitions: { change: "override", overrides: "src/domains/core/user/roles/*.role.json", export: "override", addable: true, side: "shared", overrideOf: ["label"] },\n  coreRoleDefinitions: { change: "override", overrides: "src/domains/core/user/coreRoles/*.role.json", export: "override", side: "shared", overrideOf: ["label"] },`;
  const withRoles = planExtensions(fixture({ ...files, "src/domains/core/user/extensionPoints.ts": point(ROLES) }));
  assert.deepEqual(withRoles.problems, []);
  const rows = rowsOf(withRoles.intake.content);
  assert.deepEqual(rows.filter((r) => r.includes("user/")), [
    "edit src/domains/core/user/coreRoles/*.role.override.ts",
    "edit src/domains/core/user/roles/*.role.override.ts",
    "add src/domains/core/user/roles/*.role.json",
  ]);
  assert.match(read(`  roleDefinitions: { change: "override", overrides: "src/a/*.json", export: "override", addable: false, side: "shared", overrideOf: ["a"] },`).problems[0], /addable は true だけ/);
});

test("宣言: placement の点(置き場)は placement・kind(edit | append)だけ。intake は置き場 → 画面 → 受け口 → … → region → generated の順", () => {
  const read = (body) => readDeclaration("x/extensionPoints.ts", point(body));
  assert.deepEqual(read(`  values: { change: "counterpart", placement: "src/config/**", kind: "edit" },`).problems, []);
  assert.deepEqual(read(`  catalog: { change: "counterpart", placement: "src/lib/CATALOG.md", kind: "append" },`).problems, []);
  assert.match(read(`  values: { change: "counterpart", placement: "src/config/**", kind: "add" },`).problems[0], /kind は edit \| append/);
  assert.match(read(`  values: { change: "counterpart", placement: "config/**", kind: "edit" },`).problems[0], /placement は置き場/);
  assert.match(read(`  values: { change: "counterpart", placement: "src/a/**", kind: "edit", side: "server" },`).problems[0], /placement の点に side は書けない/);
  assert.match(read(MILESTONES.replace('side: "server" }', 'side: "server", kind: "edit" }')).problems[0], /kind は placement の点だけ/);
  const rows = intakeRowsOf({
    points: [
      { owner: "src/lib/a", name: "values", declaredIn: "src/lib/a/extensionPoints.ts", spec: { change: "counterpart", placement: "src/config/**", kind: "edit" } },
      { owner: "src/domains/milestone", name: "definitions", declaredIn: "src/domains/milestone/extensionPoints.ts", spec: { change: "add", dir: "milestones", export: "m", type: { from: "a", name: "T" }, side: "server" } },
    ],
    switches: [{ path: "src/domains/core/payment/enricher.ts", point: "enricher", declaredIn: "src/domains/core/payment/extensionPoints.ts" }],
    pages: ["src/app/(user)/wallet/[slug]/page.tsx"],
    frameSwitches: ["src/app/(user)/layout.tsx"],
    generators: [{ name: "registry", outputs: ["src/registry/a.ts"], regions: ["src/registry/**/*.ts"] }],
  }).filter((r) => !r.startsWith("#")).map((r) => r.split("  #")[0]);
  const at = (row) => rows.indexOf(row);
  for (const row of ["edit src/config/**", "edit src/app/(user)/wallet/[[]slug[]]/page.tsx", "edit src/app/(user)/layout.tsx", "add src/domains/milestone/milestones/*.{ts,tsx}", "edit src/domains/core/payment/enricher.ts", "region src/registry/**/*.ts", "generated src/registry/a.ts"]) {
    assert.ok(at(row) >= 0, `${row} が無い`);
  }
  assert.ok(at("edit src/config/**") < at("edit src/app/(user)/wallet/[[]slug[]]/page.tsx"));
  assert.ok(at("edit src/app/(user)/layout.tsx") < at("add src/domains/milestone/milestones/*.{ts,tsx}"));
  assert.ok(at("add src/app/**/frame.override.ts") < at("region src/registry/**/*.ts"));
  assert.ok(at("region src/registry/**/*.ts") < at("generated src/registry/a.ts"), "同じファイルなら生成物が効く");
});

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
  assert.match(out, /import type \{ GatedCronTask, GatedDomain, GatedSettingSection, GeneratedFeatureRule \} from "@\/featureGate\/points";/);
  assert.match(out, /\{ \.\.\.rules_child, name: "child", tables: \[\], domainApiPaths: \[\], settingPaths: \[\], cronPaths: \[\], dependsOn: \["parent"\], anyOf: \[\], when: \[\] \},/);
  assert.match(out, /\{ \.\.\.rules_parent, name: "parent", tables: \[\], domainApiPaths: \[\], settingPaths: \[\], cronPaths: \[\], dependsOn: \[\], anyOf: \[\], when: \[\] \},/);
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

// ---- 門番の規則の when と値の import・住所のパターン(D23・D28・D29) ----

const SHOP_CONFIG = 'import { defineConfig } from "@/lib/defineConfig";\nexport const shopConfig = defineConfig({ a: 1 });\nexport const open: boolean = shopConfig.a === 1;\nexport const closed = false;\nexport const label = "x";\nexport const nested = { on: true };\n';

test("when: 字面を項目に写し、指された config.ts だけを import する whenInputs を書く(指されないドメインの config は読まない)", () => {
  const plan = planExtensions(
    fixture({
      "src/featureGate/extensionPoints.ts": GATE_DECLARATION,
      "src/featureGate/rules/shop.ts": `import type { FeatureGateRule } from "@/featureGate";\n${gateRule('when: ["shop.open", "shop.closed"],\n  defaultEnabled: true,')}`,
      "src/featureGate/rules/plain.ts": gateRule("defaultEnabled: true,"),
      "src/domains/core/shop/config.ts": SHOP_CONFIG,
      "src/domains/other/config.ts": "export const unused: boolean = true;\n",
    }),
  );
  assert.deepEqual(plan.problems, []);
  assert.deepEqual(itemsOf(plan, "src/featureGate", "rules").map((item) => `${item.name}:${item.fields.when.join("|")}`), ["plain:", "shop:shop.open|shop.closed"]);
  const inputs = plan.outputs["src/featureGate/extensions/whenInputs.ts"];
  assert.match(inputs, /import \{ closed as shop_closed \} from "@\/domains\/core\/shop\/config";/);
  assert.match(inputs, /import \{ open as shop_open \} from "@\/domains\/core\/shop\/config";/);
  assert.match(inputs, /"shop\.closed": shop_closed,\n {2}"shop\.open": shop_open,/);
  assert.ok(!inputs.includes("domains/other"), "指されないドメインの config は import しない");
  assert.match(plan.outputs["src/featureGate/extensions/rules.ts"], /name: "shop", .*when: \["shop\.open", "shop\.closed"\] \},/);
});

test("when・値の import・住所のパターン: 知らないドメイン・config.ts が無い・名前が無い・真偽でない・入れ子・重複・非リテラル、値の import、パターンの誤りを止める", () => {
  const plan = planExtensions(
    fixture({
      "src/featureGate/extensionPoints.ts": GATE_DECLARATION,
      "src/domains/core/shop/config.ts": SHOP_CONFIG,
      "src/domains/bare/index.ts": "export {};\n",
      "src/featureGate/rules/unknownDomain.ts": gateRule('when: ["nowhere.open"],'),
      "src/featureGate/rules/noConfig.ts": gateRule('when: ["bare.open"],'),
      "src/featureGate/rules/noName.ts": gateRule('when: ["shop.missing"],'),
      "src/featureGate/rules/notBoolean.ts": gateRule('when: ["shop.label"],'),
      "src/featureGate/rules/nestedKey.ts": gateRule('when: ["shop.nested.on"],'),
      "src/featureGate/rules/duplicated.ts": gateRule('when: ["shop.open", "shop.open"],'),
      "src/featureGate/rules/variable.ts": gateRule("when: WHEN,"),
      "src/featureGate/rules/valueImport.ts": `import { open } from "@/domains/shop/config";\n${gateRule("enabled: () => open,")}`,
      "src/featureGate/rules/badPattern.ts": 'export const rule = {\n  pathPatterns: ["/wallet/a*b", "/ok"],\n};\n',
    }),
  );
  const find = (name) => plan.problems.find((p) => p.startsWith(`src/featureGate/rules/${name}.ts: `)) ?? "";
  assert.match(find("unknownDomain"), /ドメイン nowhere が無い/);
  assert.match(find("noConfig"), /src\/domains\/bare\/config\.ts が無い/);
  assert.match(find("noName"), /最上位の export const missing が無い/);
  assert.match(find("notBoolean"), /label が真偽でない/);
  assert.match(find("nestedKey"), /"<ドメイン>\.<名前>" の文字列リテラルでない/);
  assert.match(find("duplicated"), /"shop\.open" が重複/);
  assert.match(find("variable"), /when が文字列リテラルの配列でない/);
  assert.match(find("valueImport"), /規則は値を import しない\(@\/domains\/shop\/config/);
  assert.match(find("badPattern"), /区切りの一部の \*/);
  assert.equal(plan.problems.length, 9, plan.problems.join("\n"));
});

test("requires の被覆: 機能のドメインの requires の先が自分・依存先(推移的)・常設のどれにも無ければ止め、直し方(dependsOn に足す機能)を示す", () => {
  const entry = (requires) => `export const domainEntries = {\n  x: { table: null${requires ? `, requires: ${JSON.stringify(requires)}` : ""} },\n} satisfies DomainEntries;\n`;
  const domains = {
    "src/domains/core/wallet/services/server/domainEntry.ts": entry(),
    "src/domains/core/purchase/services/server/domainEntry.ts": entry(["wallet"]),
    "src/domains/core/reward/services/server/domainEntry.ts": entry(["wallet"]),
    "src/domains/core/audit/services/server/domainEntry.ts": entry(),
    "src/domains/core/log/services/server/domainEntry.ts": entry(["audit"]),
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
  assert.match(of("payment")[0], /機能 payment のドメイン core\/purchase が requires する wallet\(core\/wallet、機能 wallet\)が、この機能・依存先\(dependsOn、推移的\)・常設のどれにも無い。dependsOn に "wallet" を足す/);
  assert.equal(of("bonus").length, 1, "依存先 payment は wallet を持たないので覆わない");
  assert.deepEqual(of("logs"), [], "requires の先 audit はどの規則にも載らない常設");
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

test("files の点: 1 つのフォルダを 2 つ以上の点が別々のファイル名で読むと、どの点にも項目が入る(D107)", () => {
  const root = fixture({
    "src/domains/note/extensionPoints.ts": point(
      [
        `  layouts: { change: "add", dir: "layouts", files: "*/layout.ts", export: "layout", type: { from: "@/t", name: "L" }, side: "server", key: "key" },`,
        `  layoutEmails: { change: "add", dir: "layouts", files: "*/email.tsx", export: "emailRenderer", type: { from: "@/t", name: "E" }, side: "server", key: "layout" },`,
        `  layoutInApps: { change: "add", dir: "layouts", files: "*/inApp.tsx", export: "inAppRenderer", type: { from: "@/t", name: "I" }, side: "client", key: "layout" },`,
      ].join("\n"),
    ),
    "src/domains/note/layouts/notice/layout.ts": 'export const layout = { key: "notice" };\n',
    "src/domains/note/layouts/notice/email.tsx": 'export const emailRenderer = { layout: "notice" };\n',
    "src/domains/note/layouts/notice/inApp.tsx": 'export const inAppRenderer = { layout: "notice" };\n',
    "src/domains/note/layouts/plain/layout.ts": 'export const layout = { key: "plain" };\n',
  });
  const plan = planExtensions(root);
  assert.deepEqual(plan.problems, []);
  assert.deepEqual(itemsOf(plan, "src/domains/note", "layouts").map((i) => i.name), ["notice", "plain"]);
  assert.deepEqual(itemsOf(plan, "src/domains/note", "layoutEmails").map((i) => i.name), ["notice"]);
  assert.deepEqual(itemsOf(plan, "src/domains/note", "layoutInApps").map((i) => i.name), ["notice"]);
  assert.match(plan.outputs["src/domains/note/extensions/layoutInApps.ts"], /import \{ inAppRenderer as layoutInApps_notice \} from "@\/domains\/note\/layouts\/notice\/inApp";/);
  rmSync(root, { recursive: true, force: true });
});
