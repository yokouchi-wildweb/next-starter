// src/wiring の配線テスト。
// 実行: pnpm test:wiring (node:test。テキストで import を読むだけなので plain node)
//
// 守りたい契約(設計: src/wiring/README.md):
// 1. 目録: src/wiring に置けるファイルは WIRING_FILES に書いたものと、fork のドット名 `<名前>[.client].<fork ID>.ts(x)`
//    （fork ID = 宣言済みの ID: 自分の project.md の fork_id: + 親の台帳名。src/lib/forkOwnership/forkIds.mjs）だけ
//    （upstream のファイルは勝手に増やさない。増やすなら README と一緒に）。2〜4 は fork のファイルにも同じに掛かる
// 2. 向き: wiring を import してよいのは src/app/**・src/proxies/**・src/proxy.ts だけ。cron のフォルダ（src/app/api/cron/<name>/）では
//    task.ts だけ（fork 所有の override.ts と 1 行の route.ts は不可）。features / lib / components / registry からは import しない
// 3. wiring どうしは import しない（別の wiring は自分で登録表を結ぶ。共有するのは lib の汎用版と登録表だけ）
// 4. 「データに届く wiring」= services/server を値 import する wiring。判定は registry → domainEntry.ts → 遅延 import（動的 import も辺に数える）
//    の鎖を辿る。domains.ts はデータに届く wiring である（鎖が切れたら生成物か検査が壊れている）
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

import { readDeclaredForkIds } from "../lib/forkOwnership/forkIds.mjs";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const srcDir = join(repoRoot, "src");
const wiringDir = join(srcDir, "wiring");

/** src/wiring に置けるファイル（目録） */
const WIRING_FILES = ["README.md", "apiRoute.ts", "domains.ts", "pageGuard.ts", "wiring.test.mjs"];

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

function isAllowedImporter(relPath) {
  if (ALLOWED_IMPORTER_FILES.includes(relPath)) return true;
  if (!ALLOWED_IMPORTER_PREFIXES.some((prefix) => relPath.startsWith(prefix))) return false;
  if (relPath.startsWith(CRON_DIR)) {
    // cron のフォルダは task.ts だけ（override.ts は fork 所有で schedule / disabled しか持てない。route.ts は 1 行）
    return /^app\/api\/cron\/[^/]+\/task\.ts$/.test(relPath);
  }
  return true;
}

/** fork のドット名 `<名前>[.client].<fork ID>.ts(x)` なら fork ID、違えば null */
export function forkIdOfWiringFile(name) {
  const m = /^[A-Za-z][A-Za-z0-9]*(?:\.client)?\.([A-Za-z0-9_-]+)\.tsx?$/.exec(name);
  return m ? m[1] : null;
}

/**
 * 目録の判定。置いてはいけないファイルの一覧を返す（空 = 問題なし）
 * @param {string[]} files src/wiring 直下のファイル名
 * @param {string[]} forkIds 宣言済みの fork ID
 */
export function catalogProblems(files, forkIds) {
  const problems = [];
  for (const name of files) {
    if (WIRING_FILES.includes(name)) continue;
    const forkId = forkIdOfWiringFile(name);
    if (forkId && forkIds.includes(forkId)) continue;
    problems.push(
      forkId
        ? `${name}（fork ID "${forkId}" は宣言されていない。.claude/rules/project.md の fork_id: か .notices/applied/<fork-id>.md の台帳名）`
        : `${name}（置けるのは WIRING_FILES と fork のドット名 <名前>[.client].<fork ID>.ts(x) だけ）`,
    );
  }
  for (const name of WIRING_FILES) if (!files.includes(name)) problems.push(`${name}（WIRING_FILES にあるのに無い）`);
  return problems;
}

test("目録の判定: upstream のファイルと宣言済み fork ID のドット名だけを受ける", () => {
  const base = [...WIRING_FILES];
  assert.deepEqual(catalogProblems([...base, "dbAgent.acme.ts", "AppProviders.client.acme.tsx", "apiRoute.parent.ts"], ["acme", "parent"]), []);
  assert.equal(catalogProblems([...base, "dbAgent.other.ts"], ["acme"]).length, 1, "宣言に無い ID は不可");
  assert.equal(catalogProblems([...base, "extra.ts"], ["acme"]).length, 1, "ドット名でない新しいファイルは不可");
  assert.equal(catalogProblems([...base, "dbAgent.a.b.ts"], ["a", "b"]).length, 1, "fork ID にドットは使えない");
  assert.equal(catalogProblems(base.filter((n) => n !== "apiRoute.ts"), []).length, 1, "upstream のファイルが消えたら不可");
});

test("目録: src/wiring にあるファイルは WIRING_FILES と宣言済み fork ID のドット名だけ", () => {
  const { all: forkIds, errors } = readDeclaredForkIds(repoRoot);
  assert.deepEqual(errors, [], errors.join("\n"));
  const files = readdirSync(wiringDir).sort();
  const problems = catalogProblems(files, forkIds);
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
function reachesServicesServer(file) {
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
      if (target && !seen.has(target)) stack.push({ file: target, path: [...path, rel] });
    }
  }
  return { reached: false, path: [] };
}

test("データに届く wiring: domains.ts は registry → domainEntry.ts → 遅延 import の鎖で services/server に届く", () => {
  const result = reachesServicesServer(join(wiringDir, "domains.ts"));
  assert.ok(result.reached, "domains.ts から services/server に届かない（登録表か domainEntry.ts の形が変わった）");
  assert.ok(result.path.some((rel) => rel === "registry/serviceRegistry.ts"), `鎖が登録表を通らない: ${result.path.join(" → ")}`);
  assert.ok(result.path.some((rel) => rel.endsWith("/domainEntry.ts")), `鎖が domainEntry.ts を通らない: ${result.path.join(" → ")}`);
});

test("データに届く wiring を import するのも同じ場所だけ（WIRING_FILES の .ts 全部を判定して記録する。fork のファイルは向きの検査で同じ場所に限る）", () => {
  const dataReaching = WIRING_FILES.filter((name) => name.endsWith(".ts") && reachesServicesServer(join(wiringDir, name)).reached);
  assert.deepEqual(dataReaching, ["apiRoute.ts", "domains.ts", "pageGuard.ts"], "データに届く wiring の一覧が変わった（README の表を直す）");
});
