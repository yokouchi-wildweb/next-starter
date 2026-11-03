// src/wiring の配線テスト。
// 実行: pnpm test:wiring (node:test。テキストで import を読むだけなので plain node)
//
// 守りたい契約(設計: src/wiring/README.md):
// 1. 目録: Tier1 では src/wiring に置けるファイルは WIRING_FILES に書いたものだけ（upstream のファイルは勝手に増やさない。
//    増やすなら README と一緒に）。fork は目録を見ない（fork が足したファイルは印なしの名前。所有は git の分岐点で ownership:check が見る）。
//    名前に fork の印（旧い `<名前>[.client].<fork ID>.ts(x)`）は全 Tier で止める（src/lib/forkOwnership/dottedNames.mjs）。2〜4 は fork のファイルにも同じに掛かる
// 2. 向き: wiring を import してよいのは src/app/**・src/proxies/**・src/proxy.ts だけ。cron のフォルダ（src/app/api/cron/<name>/）では
//    task.ts だけ（fork 所有の override.ts と 1 行の route.ts は不可）。features / lib / components / registry からは import しない
// 3. wiring どうしは import しない（別の wiring は自分で登録表を結ぶ。共有するのは lib の汎用版と登録表だけ）
//    例外は入力部品の束: AppProviders → formInputs/FormInputsRoot と、formInputs の中どうし（Root → 一覧 → 項目）と、
//    受け口: 生成物 wiring/<名前>.ts → wiring/<名前>/extensionPoints.ts が宣言した受け口の中の項目（fork が足した項目を含む）、
//    受け口の中の項目どうし（同じ受け口の中だけ）
// 4. 「データに届く wiring」= services/server を値 import する wiring。判定は registry → domainEntry.ts → 遅延 import（動的 import も辺に数える）
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

import { BUILTIN_FORM_INPUTS } from "../lib/domain/fields/formInputs.mjs";
import { classifyDottedName, oldMarkerProblem } from "../lib/forkOwnership/dottedNames.mjs";
import { readForkIdentity } from "../lib/forkOwnership/forkIds.mjs";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const srcDir = join(repoRoot, "src");
const wiringDir = join(srcDir, "wiring");

/** src/wiring に置けるファイル（目録） */
const WIRING_FILES = ["AppProviders.tsx", "README.md", "adminScreenParts.test.mts", "adminScreenParts.ts", "apiRoute.ts", "dbAgent", "dbAgent.ts", "domainConfig.ts", "domainRegistry.ts", "formInputs", "pageGuard.ts", "wiring.test.mjs"];

/** wiring を import してよい場所（src 相対の接頭辞） */
const ALLOWED_IMPORTER_PREFIXES = ["app/", "proxies/"];
const ALLOWED_IMPORTER_FILES = ["proxy.ts"];
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

/** 入力部品の束だけの例外: AppProviders → FormInputsRoot、formInputs の中どうし */
function isFormInputsBundleImport(from, to) {
  if (from === "wiring/AppProviders.tsx" && to === "wiring/formInputs/FormInputsRoot.tsx") return true;
  return from.startsWith("wiring/formInputs/") && to.startsWith("wiring/formInputs/");
}

/**
 * extensionPoints.ts の中身から受け口のフォルダ名（`dir: "..."`）を読む
 * @param {string} text
 * @returns {string[]}
 */
export function receptacleDirsOf(text) {
  return [...stripComments(text).matchAll(/\bdir:\s*["']([^"'/]+)["']/g)].map((m) => m[1]);
}

/**
 * 受け口の例外: 生成物 wiring/<名前>.ts → wiring/<名前>/<受け口>/…、同じ受け口の中の項目どうし
 * @param {string} from src 相対
 * @param {string} to src 相対
 * @param {(bundle: string) => string[]} receptacleDirs 束の名前 → 受け口のフォルダ名（wiring/<束>/extensionPoints.ts の dir）
 */
export function isReceptacleImport(from, to, receptacleDirs) {
  const target = /^wiring\/([^/]+)\/([^/]+)\/.+/.exec(to);
  if (!target) return false;
  const [, bundle, dir] = target;
  if (!receptacleDirs(bundle).includes(dir)) return false;
  if (from === `wiring/${bundle}.ts`) return true;
  return from.startsWith(`wiring/${bundle}/${dir}/`);
}

/** src/wiring/<束>/extensionPoints.ts の受け口のフォルダ名（無ければ空） */
function receptacleDirsOnDisk(bundle) {
  const file = join(wiringDir, bundle, "extensionPoints.ts");
  return existsSync(file) ? receptacleDirsOf(readFileSync(file, "utf8")) : [];
}

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

function isAllowedImporter(relPath) {
  if (ALLOWED_IMPORTER_FILES.includes(relPath)) return true;
  if (!ALLOWED_IMPORTER_PREFIXES.some((prefix) => relPath.startsWith(prefix))) return false;
  if (relPath.startsWith(CRON_DIR)) {
    // cron のフォルダは task.ts だけ（override.ts は fork 所有で schedule / disabled しか持てない。route.ts は 1 行）
    return /^app\/api\/cron\/[^/]+\/task\.ts$/.test(relPath);
  }
  return true;
}

/**
 * 目録の判定。置いてはいけないファイルの一覧を返す（空 = 問題なし）
 * @param {string[]} files src/wiring 直下のファイル名
 * @param {{ isTier1: boolean }} identity 目録（WIRING_FILES との完全一致）は Tier1 だけ。旧い fork の印は全 Tier で止める
 */
export function catalogProblems(files, { isTier1 }) {
  const problems = [];
  for (const name of files) {
    const shape = classifyDottedName(name, { folder: !/\.[A-Za-z]+$/.test(name) });
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
});

test("目録: Tier1 は src/wiring のファイルが WIRING_FILES と一致、全 Tier で旧い fork の印が無い", () => {
  const identity = readForkIdentity(repoRoot);
  assert.deepEqual(identity.errors, [], identity.errors.join("\n"));
  const files = readdirSync(wiringDir).sort();
  const problems = catalogProblems(files, { isTier1: identity.isTier1 });
  assert.deepEqual(problems, [], problems.join("\n"));
});

test("向き: wiring を import するのは src/app・src/proxies・src/proxy.ts だけ（cron は task.ts のみ）、wiring どうしは import しない", () => {
  const problems = [];
  for (const file of walk(srcDir)) {
    const rel = toPosix(relative(srcDir, file));
    if (rel.endsWith(".test.mjs") || /\.test\.(ts|tsx|mts)$/.test(rel)) continue;
    const text = readFileSync(file, "utf8");
    for (const { source } of listImportSources(text)) {
      const target = resolveSource(file, source);
      if (!target || !toPosix(relative(srcDir, target)).startsWith("wiring/")) continue;
      if (isFormInputsBundleImport(rel, toPosix(relative(srcDir, target)))) continue;
      if (isReceptacleImport(rel, toPosix(relative(srcDir, target)), receptacleDirsOnDisk)) continue;
      if (rel.startsWith("wiring/")) {
        problems.push(`${rel} → ${source}（wiring どうしは import しない。登録表と lib の汎用版を自分で結ぶ）`);
      } else if (!isAllowedImporter(rel)) {
        problems.push(`${rel} → ${source}（wiring を import してよいのは src/app・src/proxies・src/proxy.ts。cron は task.ts だけ）`);
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
    // domainEntry.ts と fork の domainEntry.override.ts は services/server に置く登録の宣言（サービス本体ではない）なので、届いた扱いにせず先を辿る
    if (/\/services\/server\//.test(rel) && !/\/domainEntry(\.override)?\.ts$/.test(rel)) return { reached: true, path: [...path, rel] };
    for (const { source } of listImportSources(readFileSync(current, "utf8"))) {
      const target = resolveSource(current, source);
      if (target && !seen.has(target) && !skip.includes(toPosix(relative(srcDir, target)))) stack.push({ file: target, path: [...path, rel] });
    }
  }
  return { reached: false, path: [] };
}

test("データに届く wiring: domainRegistry.ts は registry → domainEntry.ts → 遅延 import の鎖で services/server に届く", () => {
  // getJunctionTable の遅延 import で表の定義からも届くので、見たい鎖(登録表)だけを辿る
  const result = reachesServicesServer(join(wiringDir, "domainRegistry.ts"), { skip: ["registry/schemaRegistry.ts"] });
  assert.ok(result.reached, "domainRegistry.ts から services/server に届かない（登録表か domainEntry.ts の形が変わった）");
  assert.ok(result.path.some((rel) => rel === "registry/serviceRegistry.ts"), `鎖が登録表を通らない: ${result.path.join(" → ")}`);
  assert.ok(result.path.some((rel) => rel.endsWith("/domainEntry.ts")), `鎖が domainEntry.ts を通らない: ${result.path.join(" → ")}`);
});

/** 上流のデータに届く wiring（README の表） */
const UPSTREAM_DATA_REACHING = ["AppProviders.tsx", "adminScreenParts.ts", "apiRoute.ts", "domainRegistry.ts", "pageGuard.ts"];

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

test("受け口の例外: 生成物 wiring/<名前>.ts → 宣言された受け口の中の項目と、同じ受け口の中どうしだけ", () => {
  const dirs = (bundle) => (bundle === "dbAgent" ? ["extraTools", "promptFragments", "suffixProviders"] : []);
  assert.deepEqual(receptacleDirsOf('export const extensionPoints = {\n  a: { dir: "promptFragments" },\n  // b: { dir: "old" },\n  c: { dir: \'extraTools\' },\n};'), ["promptFragments", "extraTools"]);
  assert.equal(isReceptacleImport("wiring/dbAgent.ts", "wiring/dbAgent/promptFragments/rules.acme.ts", dirs), true);
  assert.equal(isReceptacleImport("wiring/dbAgent.ts", "wiring/dbAgent/extraTools/tool/index.ts", dirs), true);
  assert.equal(isReceptacleImport("wiring/dbAgent/extraTools/tool/index.ts", "wiring/dbAgent/extraTools/tool/schema.ts", dirs), true);
  assert.equal(isReceptacleImport("wiring/dbAgent.ts", "wiring/dbAgent/extensionPoints.ts", dirs), false, "受け口の外");
  assert.equal(isReceptacleImport("wiring/dbAgent.ts", "wiring/dbAgent/notDeclared/x.ts", dirs), false, "宣言に無いフォルダ");
  assert.equal(isReceptacleImport("wiring/apiRoute.ts", "wiring/dbAgent/promptFragments/x.ts", dirs), false, "別の wiring から");
  assert.equal(isReceptacleImport("wiring/dbAgent/promptFragments/x.ts", "wiring/dbAgent/extraTools/y.ts", dirs), false, "別の受け口へ");
  assert.equal(isReceptacleImport("wiring/dbAgent/promptFragments/x.ts", "wiring/domainRegistry.ts", dirs), false, "項目から別の wiring へ");
});

test("入力部品の束: 例外は AppProviders → Root と formInputs の中だけ、組み込みと同名の登録は落ちる", () => {
  assert.equal(isFormInputsBundleImport("wiring/AppProviders.tsx", "wiring/formInputs/FormInputsRoot.tsx"), true);
  assert.equal(isFormInputsBundleImport("wiring/formInputs/FormInputsRoot.tsx", "wiring/formInputs/extensions/inputs.ts"), true);
  assert.equal(isFormInputsBundleImport("wiring/AppProviders.tsx", "wiring/formInputs/extensions/inputs.ts"), false);
  assert.equal(isFormInputsBundleImport("wiring/AppProviders.tsx", "wiring/domains.ts"), false);
  assert.equal(isFormInputsBundleImport("wiring/formInputs/FormInputsRoot.tsx", "wiring/domains.ts"), false);
  assert.deepEqual(formInputItemProblems({ "a.ts": 'export const formInput = { name: "ticketRates", load };' }), []);
  assert.match(formInputItemProblems({ "a.ts": 'export const formInput = { name: "select", load };' }).join(), /組み込みの入力種別と同じ名前/);
  const dir = join(wiringDir, "formInputs/inputs");
  const items = Object.fromEntries(readdirSync(dir).filter((name) => /\.tsx?$/.test(name)).map((name) => [name, readFileSync(join(dir, name), "utf8")]));
  assert.deepEqual(formInputItemProblems(items), []);
});
