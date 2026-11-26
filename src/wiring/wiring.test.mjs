// src/wiring の配線テスト。
// 実行: pnpm test src/wiring/wiring.test.mjs (node:test。テキストで import を読むだけなので plain node)
//
// 守りたい契約(設計: src/wiring/README.md):
// 1. 目録: Tier1 では src/wiring に置けるファイルは WIRING_FILES に書いたものだけ（upstream のファイルは勝手に増やさない。
//    増やすなら README と一緒に）。fork は目録を見ない（fork が足したファイルは印なしの名前。所有は git の分岐点で pnpm workflow ownership check が見る）。
//    名前に fork の印（旧い `<名前>[.client].<fork ID>.ts(x)`）は全 Tier で止める（src/lib/districtMap/dottedNames.mjs）。2〜4 は fork のファイルにも同じに掛かる
// 2. 向き: wiring を import してよいのは src/app/**・src/proxies/**・src/proxy.ts と、src/instrumentation.ts(serverErrorReport.ts と startup.ts だけ)。cron のフォルダ（src/app/api/cron/<name>/）では
//    task.ts だけ（fork 所有の task.override.ts と 1 行の route.ts は不可）。domains / lib / components / registry からは import しない
// 3. wiring どうしは読まない、例外なし（D32）: wiring のファイルが読めるのは lib の入口・登録表・生成された一覧だけ。src/wiring の中で読めるのは
//    生成物（先頭に生成の印 = lib の点の一覧と結び目 src/wiring/<lib>.ts、D31）だけ。手書きの wiring どうしは読まない（共有する物は lib の入口か生成物の側に置く）
//    src/wiring はフォルダを持たない（受け口のフォルダは無い。lib の点の項目は差す側の <ドメイン か lib>/plugs/<点>/、D38）
// 4. 「データに届く wiring」= services/server を値 import する wiring。判定は registry → 遅延 import（動的 import も辺に数える）
//    の鎖を辿る。domainRegistry.ts はデータに届く wiring である（鎖が切れたら生成物か検査が壊れている）
//    一覧の完全一致は Tier1 だけ。fork は受け口の項目でデータに届く wiring が増えてよい（上流の分が残っていることを見る。増えた分も 5 が同じ場所に限る）
// 5. データに届く wiring を import してよい場所（D73 K6）: src/app の loader.ts・route.ts・cron の task.ts・API の補助ファイル
//    （src/app/api/**）、guard.ts は pageGuard の作り手だけ、root の src/app/layout.tsx は AppProviders だけ。proxies・proxy.ts は既存の契約で可。
//    それ以外の src/app（Screen・page・layout・_layout・_components の部品）は不可。AppProviders の中の AuthSessionProvider で判定を止める
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

import { BUILTIN_FORM_INPUTS } from "../lib/domain/node.mjs";
import { classifyDottedName, oldMarkerProblem } from "../lib/districtMap/index.mjs";
import { readForkIdentity } from "../lib/forkOwnership/node.mjs";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const srcDir = join(repoRoot, "src");
const wiringDir = join(srcDir, "wiring");

/** src/wiring に置けるファイル（目録） */
const WIRING_FILES = ["AppProviders.tsx", "README.md", "apiRoute.ts", "backends.ts", "business.ts", "cron.ts", "cronRoute.ts", "dbAgent.ts", "domainConfig.ts", "domainRegistry.ts", "expiryPrune.ts", "formSuite.ts", "googleTag.ts", "pageGuard.ts", "routeFactory.test.mts", "routeFactory.ts", "screen.tsx", "serverErrorReport.ts", "startup.ts", "wiring.test.mjs"];

/** wiring を import してよい場所（src 相対の接頭辞） */
const ALLOWED_IMPORTER_PREFIXES = ["app/", "proxies/"];
const ALLOWED_IMPORTER_FILES = ["proxy.ts"];
/** Next の instrumentation の入口は失敗の記録と起動時の処理の結び目(生成物)だけを読む */
const INSTRUMENTATION_FILE = "instrumentation.ts";
/** instrumentation.ts が読める結び目(生成物): 失敗の記録の onRequestError と起動時の処理の register(注文 33) */
const INSTRUMENTATION_KNOTS = ["wiring/serverErrorReport.ts", "wiring/startup.ts"];
/** 生成物の印(pnpm generate extensions・registry と同じ先頭の行) */
const GENERATED_MARK = "// 生成物・編集不可: ";
const CRON_DIR = "app/api/cron/";

const toPosix = (p) => p.split(sep).join("/");

function walk(dir, out = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === "node_modules" || entry.name.startsWith(".")) continue;
    const full = join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else if (/\.(ts|tsx|mts|mjs)$/.test(entry.name)) out.push(full);
  }
  return out;
}

function stripComments(text) {
  // 行コメントを先に消す（行コメント内の `/**` をブロックコメントの開始と誤認しないため）
  return text.replace(/^[ \t]*\/\/[^\n]*$/gm, "").replace(/\/\*[\s\S]*?\*\//g, "");
}

/** 静的 import / export from / 動的 import() の from 先（値・型を区別しない） */
function listImportSources(text) {
  const body = stripComments(text);
  const sources = [];
  for (const m of body.matchAll(/^\s*(?:import|export)\s[^;]*?from\s*["']([^"']+)["']/gm)) sources.push({ source: m[1], dynamic: false });
  for (const m of body.matchAll(/^\s*import\s*["']([^"']+)["']/gm)) sources.push({ source: m[1], dynamic: false });
  for (const m of body.matchAll(/\bimport\(\s*["']([^"']+)["']\s*\)/g)) sources.push({ source: m[1], dynamic: true });
  return sources;
}

/** import の from 先をリポ内のファイルに解決する（@/ と相対のみ。パッケージは null） */
function resolveSource(fromFile, source) {
  let base;
  if (source.startsWith("@/")) base = join(srcDir, source.slice(2));
  else if (source.startsWith(".")) base = resolve(dirname(fromFile), source);
  else return null;
  const candidates = [base, `${base}.ts`, `${base}.tsx`, `${base}.mts`, `${base}.mjs`, join(base, "index.ts"), join(base, "index.tsx")];
  for (const candidate of candidates) {
    if (existsSync(candidate) && statSync(candidate).isFile()) return candidate;
  }
  return null;
}

/** wiring のファイルが生成物か(先頭の行に生成の印)。wiring どうしで読めるのは生成物だけ(D32) */
export const isGeneratedText = (text) => text.startsWith(GENERATED_MARK);

/**
 * 入力部品の登録の問題: 組み込みの入力種別と同じ名前は不可
 * @param {Record<string, string>} items ファイル名 → 中身
 * @returns {string[]}
 */
export function formInputItemProblems(items) {
  const problems = [];
  for (const [file, text] of Object.entries(items)) {
    const name = /\bname:\s*["']([^"']+)["']/.exec(stripComments(text))?.[1];
    if (name && BUILTIN_FORM_INPUTS.includes(name)) problems.push(`${file}: "${name}" は組み込みの入力種別と同じ名前です`);
  }
  return problems;
}

/** cron の route.ts が読んでよい wiring（門番を結んだ cron の作り手） */
const CRON_ROUTE_WIRING = "wiring/cronRoute.ts";

export function isAllowedImporter(relPath, targetRel) {
  if (ALLOWED_IMPORTER_FILES.includes(relPath)) return true;
  if (relPath === INSTRUMENTATION_FILE) return INSTRUMENTATION_KNOTS.includes(targetRel);
  if (!ALLOWED_IMPORTER_PREFIXES.some((prefix) => relPath.startsWith(prefix))) return false;
  if (relPath.startsWith(CRON_DIR)) {
    // cron のフォルダは task.ts（どの wiring も可）と、1 行の route.ts（cronRoute.ts だけ）。task.override.ts は fork 所有で schedule / disabled しか持てない
    if (/^app\/api\/cron\/[^/]+\/task\.ts$/.test(relPath)) return true;
    return /^app\/api\/cron\/[^/]+\/route\.ts$/.test(relPath) && targetRel === CRON_ROUTE_WIRING;
  }
  return true;
}

test("向きの判定: cron の route.ts は cronRoute.ts だけ、task.ts はどれでも、task.override.ts は不可", () => {
  assert.equal(isAllowedImporter("app/api/cron/x/route.ts", "wiring/cronRoute.ts"), true);
  assert.equal(isAllowedImporter("app/api/cron/x/route.ts", "wiring/domainRegistry.ts"), false);
  assert.equal(isAllowedImporter("app/api/cron/x/task.ts", "wiring/domainRegistry.ts"), true);
  assert.equal(isAllowedImporter("app/api/cron/x/task.override.ts", "wiring/cronRoute.ts"), false);
  assert.equal(isAllowedImporter("domains/x/y.ts", "wiring/cronRoute.ts"), false);
});

/**
 * 目録の判定。置いてはいけないファイルの一覧を返す（空 = 問題なし）
 * @param {string[]} files src/wiring 直下のファイル名
 * @param {{ isTier1: boolean }} identity 目録（WIRING_FILES との完全一致）は Tier1 だけ。旧い fork の印は全 Tier で止める
 */
export function catalogProblems(files, { isTier1 }, isFolder = (name) => !/\.[A-Za-z]+$/.test(name)) {
  const problems = [];
  for (const name of files) {
    if (isFolder(name)) {
      problems.push(`${name}/（src/wiring はフォルダを持たない。lib の点の項目は差す側の <ドメイン か lib>/plugs/<点>/、一覧と結び目は生成物 src/wiring/<lib>.ts、D31・D38。段 3 の移し替えの道具が動かす）`);
      continue;
    }
    const shape = classifyDottedName(name, { folder: false });
    if (shape.kind === "marker") {
      const kept = shape.marker.startsWith("client.") ? ".client" : "";
      problems.push(oldMarkerProblem(name, `${shape.base}${kept}.${shape.ext}`));
      continue;
    }
    if (isTier1 && !WIRING_FILES.includes(name)) problems.push(`${name}（Tier1 の src/wiring に置けるのは WIRING_FILES だけ。増やすなら README と一緒に）`);
  }
  if (isTier1) for (const name of WIRING_FILES) if (!files.includes(name)) problems.push(`${name}（WIRING_FILES にあるのに無い）`);
  return problems;
}

test("目録の判定: Tier1 は WIRING_FILES と完全一致、fork は目録を見ない、旧い fork の印は全 Tier で止める", () => {
  const base = [...WIRING_FILES];
  assert.deepEqual(catalogProblems(base, { isTier1: true }), []);
  assert.equal(catalogProblems([...base, "extra.ts"], { isTier1: true }).length, 1, "Tier1 は目録に無いファイルを置かない");
  assert.equal(catalogProblems(base.filter((n) => n !== "apiRoute.ts"), { isTier1: true }).length, 1, "upstream のファイルが消えたら不可");
  assert.deepEqual(catalogProblems([...base, "extra.ts", "AppProviders.client.tsx"], { isTier1: false }), [], "fork が足した印なしのファイルは通る");
  const old = catalogProblems([...base, "dbAgent.acme.ts", "AppProviders.client.acme.tsx", "x.a.b.ts"], { isTier1: false });
  assert.equal(old.length, 3, old.join("\n"));
  assert.match(old[0], /印なしの dbAgent\.ts に改名.*shared-shelf marker migration notice/);
  assert.match(old[1], /印なしの AppProviders\.client\.tsx に改名/);
  assert.equal(catalogProblems([...base, "dbAgent.acme.ts"], { isTier1: true }).length, 1, "Tier1 でも印の文言 1 つ(移し方を案内)");
  assert.match(catalogProblems([...base, "serverErrors"], { isTier1: false }).join(), /src\/wiring はフォルダを持たない/, "フォルダは全 Tier で止める");
});

test("目録: Tier1 は src/wiring のファイルが WIRING_FILES と一致、全 Tier で旧い fork の印が無い", () => {
  const identity = readForkIdentity(repoRoot);
  assert.deepEqual(identity.errors, [], identity.errors.join("\n"));
  const files = readdirSync(wiringDir).sort();
  const problems = catalogProblems(files, { isTier1: identity.isTier1 }, (name) => statSync(join(wiringDir, name)).isDirectory());
  assert.deepEqual(problems, [], problems.join("\n"));
});

test("向き: wiring を import するのは src/app・src/proxies・src/proxy.ts・src/instrumentation.ts（serverErrorReport.ts と startup.ts だけ）（cron は task.ts と route.ts → cronRoute.ts）、wiring どうしは生成物だけ", () => {
  const problems = [];
  for (const file of walk(srcDir)) {
    const rel = toPosix(relative(srcDir, file));
    if (rel.endsWith(".test.mjs") || /\.test\.(ts|tsx|mts)$/.test(rel)) continue;
    const text = readFileSync(file, "utf8");
    for (const { source } of listImportSources(text)) {
      const target = resolveSource(file, source);
      if (!target || !toPosix(relative(srcDir, target)).startsWith("wiring/")) continue;
      if (rel.startsWith("wiring/")) {
        if (!isGeneratedText(readFileSync(target, "utf8"))) problems.push(`${rel} → ${source}（wiring どうしは読まない、例外なし（D32）。読めるのは lib の入口・登録表・生成された一覧だけ）`);
      } else if (!isAllowedImporter(rel, toPosix(relative(srcDir, target)))) {
        problems.push(`${rel} → ${source}（wiring を import してよいのは src/app・src/proxies・src/proxy.ts・src/instrumentation.ts（serverErrorReport.ts と startup.ts だけ）。cron は task.ts と、route.ts からの cronRoute.ts だけ）`);
      }
    }
  }
  assert.deepEqual(problems, [], problems.join("\n"));
});

/** file から import の鎖（動的 import を含む）を辿り、services/server のファイルに届くか */
function reachesServicesServer(file, { skip = [] } = {}) {
  const seen = new Set();
  const stack = [{ file, path: [] }];
  while (stack.length > 0) {
    const { file: current, path } = stack.pop();
    if (seen.has(current)) continue;
    seen.add(current);
    const rel = toPosix(relative(srcDir, current));
    if (/\/services\/server\//.test(rel)) return { reached: true, path: [...path, rel] };
    for (const { source } of listImportSources(readFileSync(current, "utf8"))) {
      const target = resolveSource(current, source);
      if (target && !seen.has(target) && !skip.includes(toPosix(relative(srcDir, target)))) stack.push({ file: target, path: [...path, rel] });
    }
  }
  return { reached: false, path: [] };
}

test("データに届く wiring: domainRegistry.ts は registry → 遅延 import の鎖で services/server に届く", () => {
  // getJunctionTable の遅延 import で表の定義からも届くので、見たい鎖(登録表)だけを辿る
  const result = reachesServicesServer(join(wiringDir, "domainRegistry.ts"), { skip: ["registry/schemaRegistry.ts"] });
  assert.ok(result.reached, "domainRegistry.ts から services/server に届かない（登録表の形が変わった）");
  const at = result.path.indexOf("registry/serviceRegistry.ts");
  assert.ok(at >= 0, `鎖が登録表を通らない: ${result.path.join(" → ")}`);
  // 登録表の行の service: () => import("@/domains/<d>/services/server/…") で直に届く(間に登録の宣言のファイルを挟まない)
  assert.match(result.path[at + 1] ?? "", /\/services\/server\//, `登録表の次が services/server でない: ${result.path.join(" → ")}`);
});

/** 上流のデータに届く wiring（README の表） */
const UPSTREAM_DATA_REACHING = ["AppProviders.tsx", "apiRoute.ts", "cron.ts", "cronRoute.ts", "domainRegistry.ts", "expiryPrune.ts", "pageGuard.ts", "routeFactory.ts"];

test("データに届く wiring を import するのも同じ場所だけ（WIRING_FILES の .ts / .tsx 全部を判定して記録する。fork のファイルは向きの検査で同じ場所に限る）", () => {
  const dataReaching = WIRING_FILES.filter((name) => /\.tsx?$/.test(name) && reachesServicesServer(join(wiringDir, name)).reached);
  if (readForkIdentity(repoRoot).isTier1) {
    assert.deepEqual(dataReaching, UPSTREAM_DATA_REACHING, "データに届く wiring の一覧が変わった（README の表を直す）");
    return;
  }
  // fork: 受け口の項目（dbAgent の promptFragments など）でデータに届く wiring が増えてよい。上流の分は鎖が残っていること
  const missing = UPSTREAM_DATA_REACHING.filter((name) => !dataReaching.includes(name));
  assert.deepEqual(missing, [], `上流のデータに届く wiring が届かなくなった: ${missing.join(", ")}`);
});

/**
 * データに届く wiring を import してよいか（D73 K6）。importerRel = src 相対、wiringName = src/wiring 直下のファイル名。
 * 問題があれば理由、無ければ null
 */
export function dataReachingImportProblem(importerRel, wiringName) {
  // pageGuard.client.ts のような点つきの名前も同じ作り手として扱う
  const base = wiringName.split(".")[0];
  if (importerRel.startsWith("proxies/") || importerRel === "proxy.ts") return null;
  if (!importerRel.startsWith("app/")) return null; // app の外は向きの検査が止める
  if (/(^|\/)loader\.ts$/.test(importerRel) || /(^|\/)route\.tsx?$/.test(importerRel)) return null;
  if (importerRel.startsWith("app/api/")) return null; // API の補助ファイル（cron の task.ts を含む。cron の他は向きの検査が止める）
  if (/(^|\/)guard\.ts$/.test(importerRel)) return base === "pageGuard" ? null : "guard.ts が import してよいのは @/wiring/pageGuard の作り手だけ";
  if (importerRel === "app/layout.tsx") return base === "AppProviders" ? null : "root layout が import してよいのは @/wiring/AppProviders だけ";
  return "データに届く wiring を import してよいのは loader.ts・route.ts・API の補助ファイル・guard.ts（pageGuard）・root layout（AppProviders）だけ（UI の場所はデータを取らない）";
}

test("データに届く wiring の import の場所の判定（D73 K6）", () => {
  assert.equal(dataReachingImportProblem("app/foo/_screen/loader.ts", "domainRegistry.ts"), null);
  assert.equal(dataReachingImportProblem("app/api/foo/route.ts", "apiRoute.ts"), null);
  assert.equal(dataReachingImportProblem("app/api/foo/_shared/helper.ts", "domainRegistry.ts"), null);
  assert.equal(dataReachingImportProblem("app/api/cron/x/task.ts", "domainRegistry.ts"), null);
  assert.equal(dataReachingImportProblem("app/guard.ts", "pageGuard.ts"), null);
  assert.equal(dataReachingImportProblem("app/guard.ts", "pageGuard.acme.ts"), null);
  assert.equal(dataReachingImportProblem("app/layout.tsx", "AppProviders.tsx"), null);
  assert.equal(dataReachingImportProblem("proxies/foo.ts", "domainRegistry.ts"), null);
  assert.ok(dataReachingImportProblem("app/foo/_screen/FooScreen.tsx", "domainRegistry.ts"));
  assert.ok(dataReachingImportProblem("app/foo/page.tsx", "domainRegistry.ts"));
  assert.ok(dataReachingImportProblem("app/admin/layout.tsx", "AppProviders.tsx"));
  assert.ok(dataReachingImportProblem("app/foo/_components/Part.tsx", "domainRegistry.ts"));
  assert.ok(dataReachingImportProblem("app/guard.ts", "domainRegistry.ts"));
  assert.ok(dataReachingImportProblem("app/layout.tsx", "domainRegistry.ts"));
});

test("データに届く wiring を import する src/app のファイルが許された場所だけ（D73 K6）", () => {
  const reaching = new Map();
  const problems = [];
  for (const file of walk(join(srcDir, "app"))) {
    const rel = toPosix(relative(srcDir, file));
    if (rel.endsWith(".test.mjs") || /\.test\.(ts|tsx|mts)$/.test(rel)) continue;
    for (const { source } of listImportSources(readFileSync(file, "utf8"))) {
      const target = resolveSource(file, source);
      if (!target) continue;
      const targetRel = toPosix(relative(srcDir, target));
      if (!targetRel.startsWith("wiring/")) continue;
      if (!reaching.has(target)) reaching.set(target, reachesServicesServer(target).reached);
      if (!reaching.get(target)) continue;
      const problem = dataReachingImportProblem(rel, targetRel.slice("wiring/".length));
      if (problem) problems.push(`${rel} → ${source}（${problem}）`);
    }
  }
  assert.deepEqual(problems, [], problems.join("\n"));
});

test("結線どうし（D32）: 読めるのは生成物だけ、instrumentation.ts は serverErrorReport.ts と startup.ts だけ、組み込みと同名の登録は落ちる", () => {
  assert.equal(isGeneratedText("// 生成物・編集不可: pnpm generate extensions が src/lib/serverErrorReport/extensionPoints.ts から生成する\n"), true);
  assert.equal(isGeneratedText("// src/wiring/apiRoute.ts\n"), false);
  assert.equal(isAllowedImporter("instrumentation.ts", "wiring/serverErrorReport.ts"), true);
  assert.equal(isAllowedImporter("instrumentation.ts", "wiring/startup.ts"), true);
  assert.equal(isAllowedImporter("instrumentation.ts", "wiring/apiRoute.ts"), false);
  assert.deepEqual(formInputItemProblems({ "a.ts": 'export const formInput = { name: "ticketRates", load };' }), []);
  assert.match(formInputItemProblems({ "a.ts": 'export const formInput = { name: "select", load };' }).join(), /組み込みの入力種別と同じ名前/);
  // 項目は差す側の <ドメイン か lib>/plugs/formInputs/（宣言 src/lib/formSuite/extensionPoints.ts の formInputs）
  const items = {};
  for (const file of walk(srcDir)) {
    const rel = toPosix(relative(srcDir, file));
    if (/(^|\/)plugs\/formInputs\/[^/]+\.tsx?$/.test(rel)) items[rel] = readFileSync(file, "utf8");
  }
  assert.deepEqual(formInputItemProblems(items), []);
});
