#!/usr/bin/env node
// scripts/codemods/fork-name-markers.mjs
// 受け口のファイル名から fork の名前の印を外す移行(共有の棚の印の移行、D136・D137)。fork のリポのルートで走らせる。
// 使い方: node scripts/codemods/fork-name-markers.mjs [--apply] [--base <rev>] [--no-generate] [--json]
//   既定は dry-run(変更の一覧と止める一覧を出すだけ)。--apply で改名・import の書き換え・常時実行の例外の分割をし、
//   最後に pnpm extensions:generate を走らせる(--no-generate で省く)。手順: ./README.md「fork の名前の印を外す」
//
// 印 = 点つきの名前のうち .default / .replace / .override / .client / .test 以外の語(src/lib/forkOwnership/dottedNames.mjs)。
// 自分の fork_id でも親の名前でも食い違った語(.bodolist)でも拾う。触るのは受け口の場所だけ:
// - 宣言の受け口のフォルダの直下の項目(ファイル・フォルダ形)→ 印を外す
// - <名前>.default の隣の <名前>.<印>(1 行スイッチの fork の実装)→ <名前>.replace(スイッチの行は import の書き換えで追従)
// - src/app の _layout / _screen の下 → 隣に置き換える既定があれば <名前>.replace、無ければ fork だけの部品として印を外す
// - scripts/tasks・src/wiring の直下 → 印を外す(client の中置きは残す)
// - scripts/proxies/alwaysOnExceptions.<印>.mjs → 行ごとに alwaysOnExceptions/<名前>.mjs(exception か registry)へ分ける
// - src/**/extensionPoints.<印>.ts → 機械では決められないので止める(fork 自身のフォルダの extensionPoints.ts へ移す)
// 新しい名前の単位が基準(台帳の最後の upstream:<sha> の版)か、ほかの HEAD のファイルの単位と同じなら衝突: 書き換えず、
// 改名の案を付けて止める。案は決まった規則で作るので、中間 Tier から受け継いだ物は中間 Tier の移行と同じ名前になる。

import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { join, posix } from "node:path";
import { fileURLToPath } from "node:url";

import ts from "typescript";

import { lastUpstreamSha } from "../../src/lib/forkOwnership/check.mjs";
import { DECLARATION_NAME, findDeclarationFiles, literalOf } from "../../src/lib/forkOwnership/declarations.mjs";
import { classifyDottedName } from "../../src/lib/forkOwnership/dottedNames.mjs";
import { readForkIdentity } from "../../src/lib/forkOwnership/forkIds.mjs";
import { unitName } from "../../src/lib/forkOwnership/unitNames.mjs";

const KEEP = new Set(["default", "replace", "client"]);
const CODE = /\.(ts|tsx|mts|cts|mjs|js|cjs)$/;
const SKIP_DIRS = new Set(["node_modules", ".next", ".git", ".turbo", "dist", "coverage"]);
const ALWAYS_ON_DIR = "scripts/proxies/alwaysOnExceptions";

/** リポの中のファイル(src・scripts の下、リポジトリ直下からの相対) */
function listFiles(root) {
  const out = [];
  const walk = (rel) => {
    const abs = join(root, rel);
    if (!existsSync(abs)) return;
    for (const entry of readdirSync(abs, { withFileTypes: true })) {
      if (SKIP_DIRS.has(entry.name)) continue;
      const path = `${rel}/${entry.name}`;
      if (entry.isDirectory()) walk(path);
      else if (entry.isFile()) out.push(path);
    }
  };
  walk("src");
  walk("scripts");
  return out.sort();
}

/** 印の語を外した名前(既知の中置き client・default・replace は残す)。印が無ければ null */
export function stripMarker(name, { folder = false } = {}) {
  const shape = classifyDottedName(name, { folder });
  if (shape.kind !== "marker") return null;
  const lastDot = folder ? -1 : name.lastIndexOf(".");
  const stem = lastDot > 0 ? name.slice(0, lastDot) : name;
  const ext = lastDot > 0 ? name.slice(lastDot) : "";
  const [base, ...rest] = stem.split(".");
  const kept = rest.filter((seg) => KEEP.has(seg));
  const marker = rest.filter((seg) => !KEEP.has(seg)).join(".");
  return { name: [base, ...kept].join(".") + ext, base, marker, ext };
}

const pascal = (word) => word.split(/[^A-Za-z0-9]+/).filter(Boolean).map((w) => w[0].toUpperCase() + w.slice(1)).join("");

/** 衝突したときの改名の案(決まった規則: 項目 = <名前><印の Pascal>、タスク = <名前>-<印>) */
function suggestName(stripped, dir) {
  if (dir === "scripts/tasks") return `${stripped.base}-${stripped.marker.replace(/\./g, "-")}${stripped.ext}`;
  return `${stripped.base}${pascal(stripped.marker)}${stripped.ext}`;
}

/** 宣言の受け口のフォルダ(形の検査はしない。旧い形の宣言でも dir の字面を読む) */
function receptacleDirs(root) {
  const dirs = new Set();
  const { files } = findDeclarationFiles(root);
  for (const path of files) {
    const source = ts.createSourceFile(path, readFileSync(join(root, path), "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
    for (const statement of source.statements) {
      if (!ts.isVariableStatement(statement)) continue;
      for (const declaration of statement.declarationList.declarations) {
        if (!ts.isIdentifier(declaration.name) || declaration.name.text !== DECLARATION_NAME || !declaration.initializer) continue;
        const read = literalOf(declaration.initializer);
        if (read.problem || typeof read.value !== "object" || read.value === null) continue;
        for (const point of Object.values(read.value)) {
          if (point && typeof point.dir === "string") dirs.add(posix.normalize(posix.join(posix.dirname(path), point.dir)));
        }
      }
    }
  }
  return dirs;
}

const isRouteNeighbour = (path) => /^src\/app\/(?:.*\/)?(?:_layout|_screen)\//.test(path);

/**
 * 移行の計画を立てる(書き換えない)
 * @param {string} root fork のリポのルート
 * @param {{ baseFiles: string[] }} options baseFiles = 基準の版のファイル(衝突の判定)
 * @returns {{ changes: { from: string, to: string, kind: string, folder?: boolean }[], stops: { path: string, reason: string, suggest?: string }[], alwaysOn: { from: string }[] }}
 */
export function planMigration(root, { baseFiles }) {
  const files = listFiles(root);
  const present = new Set(files);
  const dirs = receptacleDirs(root);
  const candidates = [];
  const stops = [];
  const alwaysOn = [];
  const seen = new Set();
  const push = (entry) => {
    if (seen.has(entry.from)) return;
    seen.add(entry.from);
    candidates.push(entry);
  };

  for (const path of files) {
    const dir = posix.dirname(path);
    const name = posix.basename(path);
    // 拡張点の宣言の旧い形
    if (path.startsWith("src/") && classifyDottedName(name).base === DECLARATION_NAME && classifyDottedName(name).kind === "marker") {
      stops.push({ path, reason: `${DECLARATION_NAME}.<印>.ts は機械では移せない: fork 自身のフォルダ(fork が足したドメイン・lib)の ${DECLARATION_NAME}.ts に点を移し、受け口のフォルダも一緒に移す` });
      continue;
    }
    // 常時実行の例外の旧い形
    if (dir === "scripts/proxies" && name.startsWith("alwaysOnExceptions.") && name.endsWith(".mjs")) {
      alwaysOn.push({ from: path });
      continue;
    }
    // 受け口の直下の項目: ファイル形
    if (dirs.has(dir)) {
      const stripped = stripMarker(name);
      if (stripped) push({ from: path, to: `${dir}/${stripped.name}`, kind: "item", stripped, dir });
      if (stripped || classifyDottedName(name).kind !== "plain") continue;
    }
    // 受け口の直下の項目: フォルダ形(パスの途中の段が受け口の直下のフォルダ)
    const segments = path.split("/");
    let folderHandled = false;
    for (let i = 1; i < segments.length - 1; i += 1) {
      const parent = segments.slice(0, i).join("/");
      if (!dirs.has(parent)) continue;
      const stripped = stripMarker(segments[i], { folder: true });
      if (stripped) {
        const from = segments.slice(0, i + 1).join("/");
        push({ from, to: `${parent}/${stripped.name}`, kind: "item", stripped, dir: parent, folder: true });
        folderHandled = true;
      }
      break;
    }
    if (folderHandled) continue;
    const stripped = stripMarker(name);
    if (!stripped || classifyDottedName(name).kind === "test") continue;
    // 1 行スイッチの fork の実装
    if (CODE.test(name) && ["ts", "tsx"].some((ext) => present.has(`${dir}/${stripped.base}.default.${ext}`))) {
      push({ from: path, to: `${dir}/${stripped.base}.replace${stripped.ext}`, kind: "switch", stripped, dir });
      continue;
    }
    // route の隣(_layout / _screen の下)
    if (isRouteNeighbour(path)) {
      const hasDefault = [`${stripped.base}.tsx`, `${stripped.base}.ts`, `${stripped.base}/index.tsx`, `${stripped.base}/index.ts`].some((rel) => present.has(`${dir}/${rel}`));
      const replace = hasDefault && CODE.test(name);
      push({ from: path, to: `${dir}/${replace ? `${stripped.base}.replace${stripped.ext}` : stripped.name}`, kind: replace ? "route-replace" : "route-part", stripped, dir });
      continue;
    }
    // scripts/tasks・src/wiring の直下
    if (dir === "scripts/tasks" || dir === "src/wiring") {
      push({ from: path, to: `${dir}/${stripped.name}`, kind: dir === "scripts/tasks" ? "task" : "wiring", stripped, dir });
    }
  }

  // 衝突: 新しい単位が基準の単位・ほかの HEAD のファイルの単位・ほかの移行先と同じ
  const targetFroms = candidates.map((c) => c.from);
  const underTarget = (path) => targetFroms.some((from) => path === from || path.startsWith(`${from}/`));
  const taken = new Set([...baseFiles.map(unitName), ...files.filter((f) => !underTarget(f)).map(unitName)]);
  const byUnit = new Map();
  for (const c of candidates) byUnit.set(unitName(c.to), [...(byUnit.get(unitName(c.to)) ?? []), c]);
  const changes = [];
  for (const c of candidates) {
    const unit = unitName(c.to);
    const dup = byUnit.get(unit).length > 1;
    if (taken.has(unit) || dup) {
      const suggest = `${c.dir}/${suggestName(c.stripped, c.dir)}`;
      stops.push({ path: c.from, reason: dup ? `印を外すと ${c.to} がほかの移行先と重なる` : `印を外すと ${c.to} が上流(基準)かほかのファイルと同じ単位名になる(unit-clash)`, suggest });
      continue;
    }
    changes.push({ from: c.from, to: c.to, kind: c.kind, ...(c.folder ? { folder: true } : {}) });
  }
  return { changes, stops: stops.sort((a, b) => (a.path < b.path ? -1 : 1)), alwaysOn };
}

// ── import の書き換え ──

const SPECIFIER = /(\bfrom\s*|\bimport\s*\(\s*|\bimport\s+|\brequire\s*\(\s*|\bexport\s*\*\s*from\s*)(["'])([^"'\n]+)\2/g;
const stripExt = (path) => path.replace(/\.(tsx?|mts|mjs|js|cjs)$/, "");

/** 移行の対応表で 1 つのファイルの import を書き換える。{ text, changed } */
export function rewriteImports(text, importerOld, importerNew, changes) {
  const files = new Map(changes.filter((c) => !c.folder).map((c) => [stripExt(c.from), stripExt(c.to)]));
  const folders = changes.filter((c) => c.folder);
  let changed = false;
  const out = text.replace(SPECIFIER, (whole, lead, quote, spec) => {
    let resolved;
    if (spec.startsWith("@/")) resolved = `src/${spec.slice(2)}`;
    else if (spec.startsWith("./") || spec.startsWith("../")) resolved = posix.normalize(posix.join(posix.dirname(importerOld), spec));
    else return whole;
    const extMatch = /\.(tsx?|mts|mjs|js|cjs)$/.exec(resolved);
    const bare = stripExt(resolved);
    let target = files.get(bare) ?? null;
    if (target === null) {
      const folder = folders.find((c) => bare === c.from || bare.startsWith(`${c.from}/`));
      if (folder) target = folder.to + bare.slice(folder.from.length);
    }
    if (target === null) {
      // 移らないファイルを指す: 書き手が移ったフォルダの中でも深さは変わらないので書き換え不要
      return whole;
    }
    const withExt = extMatch ? `${target}${extMatch[0]}` : target;
    let next;
    if (spec.startsWith("@/")) next = `@/${withExt.slice("src/".length)}`;
    else {
      next = posix.relative(posix.dirname(importerNew), withExt);
      if (!next.startsWith(".")) next = `./${next}`;
    }
    if (next === spec) return whole;
    changed = true;
    return `${lead}${quote}${next}${quote}`;
  });
  return { text: out, changed };
}

/** 移行の後のパス(フォルダの改名の中のファイルも) */
const movedPath = (path, changes) => {
  for (const c of changes) {
    if (path === c.from) return c.to;
    if (c.folder && path.startsWith(`${c.from}/`)) return c.to + path.slice(c.from.length);
  }
  return path;
};

// ── 常時実行の例外の分割 ──

function readRows(text, label) {
  const source = ts.createSourceFile(label, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
  const rows = [];
  for (const statement of source.statements) {
    if (!ts.isVariableStatement(statement)) continue;
    for (const declaration of statement.declarationList.declarations) {
      if (!ts.isIdentifier(declaration.name) || !declaration.initializer) continue;
      const kind = { exceptions: "exception", registries: "registry" }[declaration.name.text];
      if (!kind) continue;
      const read = literalOf(declaration.initializer);
      if (read.problem || !Array.isArray(read.value)) return { problem: `${declaration.name.text} がリテラルの配列でない` };
      for (const row of read.value) rows.push({ kind, file: row?.file, reason: row?.reason });
    }
  }
  return { rows };
}

/** alwaysOnExceptions.<印>.mjs を行ごとのファイルにする計画。{ files: { path, text }[] } か { problem } */
export function splitAlwaysOn(text, label, changes, existing) {
  const read = readRows(text, label);
  if (read.problem) return { problem: read.problem };
  const used = new Set(existing);
  const files = [];
  for (const row of read.rows) {
    if (typeof row.file !== "string" || typeof row.reason !== "string") return { problem: "行に file と reason(文字列)が無い" };
    const file = movedPath(row.file, changes);
    let name = posix.basename(file).split(".")[0].replace(/[^A-Za-z0-9-]/g, "") || "item";
    if (!/^[A-Za-z]/.test(name)) name = `item${name}`;
    let candidate = name;
    for (let n = 2; used.has(candidate); n += 1) candidate = `${name}${n}`;
    used.add(candidate);
    files.push({
      path: `${ALWAYS_ON_DIR}/${candidate}.mjs`,
      text: `// 常時実行の入口の${row.kind === "exception" ? "例外(常に読み込まれる結線)" : "登録表(fork の手書き)"}。${label} から移した(共有の棚の印の移行)\nexport const ${row.kind} = ${JSON.stringify({ file, reason: row.reason }, null, 2).replace(/"(file|reason)":/g, "$1:")};\n`,
    });
  }
  return { files };
}

/**
 * 計画を当てる(改名・import の書き換え・常時実行の例外の分割)
 * @returns {{ renamed: number, importEdits: string[], alwaysOnFiles: string[], stops: object[] }}
 */
export function applyMigration(root, plan) {
  const { changes } = plan;
  const stops = [];
  const importEdits = [];
  // 1. import の書き換え(改名の前に、旧いパスで読んで書く)
  for (const path of listFiles(root).filter((p) => CODE.test(p))) {
    const text = readFileSync(join(root, path), "utf8");
    const result = rewriteImports(text, path, movedPath(path, changes), changes);
    if (result.changed) {
      writeFileSync(join(root, path), result.text);
      importEdits.push(movedPath(path, changes));
    }
  }
  // 2. 改名(フォルダは中身ごと)。git の作業ツリーで追跡済みなら git mv(rename として index に載る)
  const tracked = (path) => spawnSync("git", ["ls-files", "--error-unmatch", path], { cwd: root, stdio: "ignore" }).status === 0;
  for (const c of changes) {
    mkdirSync(join(root, posix.dirname(c.to)), { recursive: true });
    if (tracked(c.from)) execFileSync("git", ["mv", c.from, c.to], { cwd: root, stdio: "ignore" });
    else renameSync(join(root, c.from), join(root, c.to));
  }
  // 3. 常時実行の例外
  const alwaysOnFiles = [];
  for (const { from } of plan.alwaysOn) {
    const dir = join(root, ALWAYS_ON_DIR);
    const existing = existsSync(dir) ? readdirSync(dir).map((n) => n.replace(/\.mjs$/, "")) : [];
    const split = splitAlwaysOn(readFileSync(join(root, from), "utf8"), from, changes, existing);
    if (split.problem) {
      stops.push({ path: from, reason: `分けられない(${split.problem})。行ごとに ${ALWAYS_ON_DIR}/<名前>.mjs へ手で移す` });
      continue;
    }
    mkdirSync(dir, { recursive: true });
    for (const file of split.files) {
      writeFileSync(join(root, file.path), file.text);
      alwaysOnFiles.push(file.path);
    }
    rmSync(join(root, from));
  }
  return { renamed: changes.length, importEdits: importEdits.sort(), alwaysOnFiles, stops };
}

/** 基準の版のファイル(台帳の最後の upstream:<sha>、--base で上書き) */
export function readBaseFiles(root, base) {
  let rev = base;
  if (!rev) {
    const { own } = readForkIdentity(root);
    const ledger = own ? join(root, ".notices/applied", `${own}.md`) : null;
    rev = ledger && existsSync(ledger) ? lastUpstreamSha(readFileSync(ledger, "utf8")) : null;
    if (!rev) return { problem: "基準の版が決まらない(.claude/rules/project.md の fork_id: と台帳の upstream:<sha> を確かめるか --base <rev> を渡す)" };
  }
  try {
    const out = execFileSync("git", ["ls-tree", "-r", "--name-only", rev], { cwd: root, encoding: "utf8", maxBuffer: 256 * 1024 * 1024 });
    return { rev, files: out.split("\n").filter(Boolean) };
  } catch {
    return { problem: `基準の版 ${rev} を読めない(git の履歴に無い)` };
  }
}

function main() {
  const args = process.argv.slice(2);
  const root = process.cwd();
  const apply = args.includes("--apply");
  const json = args.includes("--json");
  const baseIndex = args.indexOf("--base");
  const base = readBaseFiles(root, baseIndex >= 0 ? args[baseIndex + 1] : null);
  if (base.problem) {
    console.error(`[fork-name-markers] ${base.problem}`);
    process.exit(2);
  }
  const plan = planMigration(root, { baseFiles: base.files });
  const result = { base: base.rev, mode: apply ? "apply" : "dry-run", changes: plan.changes, stops: plan.stops, alwaysOn: plan.alwaysOn.map((a) => a.from) };
  if (apply) {
    const applied = applyMigration(root, plan);
    Object.assign(result, { importEdits: applied.importEdits, alwaysOnFiles: applied.alwaysOnFiles });
    result.stops = [...result.stops, ...applied.stops];
    if (!args.includes("--no-generate")) {
      const generated = spawnSync("pnpm", ["extensions:generate"], { cwd: root, encoding: "utf8" });
      result.generate = { status: generated.status, output: `${generated.stdout ?? ""}${generated.stderr ?? ""}`.trim().split("\n").slice(-8).join("\n") };
    }
  }
  if (json) {
    console.log(JSON.stringify(result, null, 2));
  } else {
    console.log(`[fork-name-markers] ${result.mode}(基準 ${String(base.rev).slice(0, 10)})`);
    console.log(`変更: ${plan.changes.length} 件`);
    for (const c of plan.changes) console.log(`  ${c.from} → ${c.to}  [${c.kind}]`);
    if (plan.alwaysOn.length > 0) console.log(`常時実行の例外の分割: ${plan.alwaysOn.map((a) => a.from).join(", ")}`);
    console.log(`止めた物(書き換えない): ${result.stops.length} 件`);
    for (const s of result.stops) console.log(`  ${s.path}: ${s.reason}${s.suggest ? ` → 案: ${s.suggest} に改名してからもう一度` : ""}`);
    if (apply) {
      console.log(`import の書き換え: ${result.importEdits.length} ファイル`);
      if (result.generate) console.log(`pnpm extensions:generate: exit ${result.generate.status}\n${result.generate.output}`);
      console.log("JSON・Markdown の中のパスの字面は書き換えない(必要なら手で直す)");
    }
  }
  if (apply && result.generate && result.generate.status !== 0) process.exit(1);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main();
