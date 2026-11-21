// scripts/structure/lib-package/moved.mjs
//
// pnpm check lib-package -- moved --base <rev> [--head <rev>] [--json]
// 閉じた lib への付け替えの表(notice の材料)を、宣言と git の差分から出す。lib の名前は持たない(閉じた lib が増えればそのまま使える)。
// - moved:  ファイルの行(notice の moved: 欄、/flux が fork の編集を移す)= <base>→<head> で git が改名と見た行のうち、
//           新しいパスが閉じた lib の中で、古いパスがその lib の外の物
// - imports: 指定子の行(notice の notes: と codemod の手順)= <base> で使われていた "@/…" の指定子が、<head> では閉じた lib の
//           入口でない中のファイルを指す物 → その名前を出す入口(codemod.mjs の entryForFile と同じ求め方)
// - deleted: <base> の指定子の先が <head> で消え、改名も無い物(推し量らない。notes: に書く材料)。
//           ただし閉じた lib の中の束(re-export だけのファイル。例 入口 "." にたたんで消した src/lib/storage/client/index.ts)は
//           <base> の版を読み、出していた名前ごとに今それを出す入口を引いて imports: の行にする(byName = 名前 → { to, name }。
//           codemod が名前ごとに書き換える)。どの入口からも出ていない名前があれば unresolved
// 行にするのは <base>..<head> の変更で生まれた物だけ: imports: / unresolved: は、指定子の先のファイルが改名されたか、
// その lib の package.json が <base>..<head> で足された・変わった物(<base> で既に閉じていた lib の中を読む古い書き方は出さない)
// 印のファイル(入口を re-export するためだけに残したファイル。例 src/lib/drizzle/transaction.ts)は re-export を辿って入口を求める
// 閉じた lib = 作業ツリーで package.json を持ち形に問題の無い lib(宣言は作業ツリーから読む。--head は改名の比べ先)。

import { execFileSync } from "node:child_process";
import path from "node:path";

import ts from "typescript";

import { resolveImport } from "../../../eslint-rules/resolve-import.mjs";
import { libOfPath } from "../../../src/lib/libPackage/index.mjs";
import { readLibPackage } from "../../../src/lib/libPackage/node.mjs";
import { createExportReader, entryForFile, entryIndex, entrySpecifier, probeFile } from "./codemod.mjs";

const SOURCE_EXTS = ["ts", "tsx", "mts", "mjs", "js"];
const SPEC_RE = /["'](@\/[^"'\s]+)["']/g;

const git = (root, args) => execFileSync("git", args, { cwd: root, encoding: "utf8", maxBuffer: 256 * 1024 * 1024 });

const closedPkg = (root, lib) => {
  const pkg = lib ? readLibPackage(root, lib) : null;
  return pkg && pkg.problems.length === 0 ? pkg : null;
};

/** 解いたパス(拡張子・index なし可)→ その版にあるファイル(無ければ null) */
function fileIn(tree, resolved) {
  if (tree.has(resolved)) return resolved;
  for (const ext of SOURCE_EXTS) if (tree.has(`${resolved}.${ext}`)) return `${resolved}.${ext}`;
  for (const ext of SOURCE_EXTS) if (tree.has(`${resolved}/index.${ext}`)) return `${resolved}/index.${ext}`;
  return null;
}

/** 入口の鍵 → 指定子("." → @/lib/<lib>、"./x" → @/lib/<lib>/x) */

/**
 * 印のファイル(出す名前が全部、同じ lib の 1 つの入口から出ている re-export だけのファイル)の入口の鍵。違えば null
 * entryForFile は名前の実体が置かれたファイルで入口を引くので、実体を持たない印は引けない。印が出す名前の実体で引き直す
 */
function entryForMarker(root, lib, file, reader) {
  const real = probeFile(root, file);
  const names = real ? reader.exportsOf(real) : null;
  if (!names || names.size === 0) return null;
  const index = entryIndex(root, lib, reader);
  const keys = new Set();
  for (const origin of names.values()) {
    if (origin.file === real) return null; // 自分で実体を持つ = 印ではない
    const row = index.find((r) => r.origin.file === origin.file && r.origin.name === origin.name);
    if (!row) return null;
    keys.add(row.key);
  }
  return keys.size === 1 ? [...keys][0] : null;
}

/**
 * <base> で消えた束(re-export だけのファイル)が出していた名前 → 今の実体 { file, name }。束でない・先が読めなければ null
 * 束の文は export … from "./x" と export * from "./x" だけ(相対)。"./x" は今の木で解き、名前の実体は今の export の辿りで求める
 * @param {string} baseFile repo 相対(<base> の版にあるパス)
 */
export function barrelOrigins(root, base, baseFile, reader) {
  let text;
  try {
    text = git(root, ["show", `${base}:${baseFile}`]);
  } catch {
    return null;
  }
  const kind = baseFile.endsWith(".tsx") ? ts.ScriptKind.TSX : /\.(mjs|js|cjs)$/.test(baseFile) ? ts.ScriptKind.JS : ts.ScriptKind.TS;
  const sf = ts.createSourceFile(baseFile, text, ts.ScriptTarget.Latest, true, kind);
  const out = new Map();
  for (const st of sf.statements) {
    if (!ts.isExportDeclaration(st) || !st.moduleSpecifier || !ts.isStringLiteral(st.moduleSpecifier)) return null;
    const spec = st.moduleSpecifier.text;
    if (!spec.startsWith(".")) return null;
    const target = probeFile(root, path.posix.join(path.posix.dirname(baseFile), spec));
    const names = target ? reader.exportsOf(target) : null;
    if (!names) return null;
    const clause = st.exportClause;
    if (!clause) {
      for (const [name, origin] of names) if (name !== "default" && !out.has(name)) out.set(name, origin);
    } else if (ts.isNamedExports(clause)) {
      for (const el of clause.elements) {
        const origin = names.get((el.propertyName ?? el.name).text);
        if (!origin) return null;
        out.set(el.name.text, origin);
      }
    } else {
      return null; // export * as ns
    }
  }
  return out.size > 0 ? out : null;
}

/**
 * 消えた束の名前ごとの行き先(今の入口)。{ byName, to } か、どの入口からも出ていない名前があれば { missing }
 * 同じ実体を出す入口が複数なら、同じ名前の物を優先、次に "."(entryIndex の順)
 */
function barrelTargets(root, lib, origins, reader) {
  const index = entryIndex(root, lib, reader);
  const byName = {};
  const missing = [];
  for (const [name, origin] of origins) {
    const hits = index.filter((r) => r.origin.file === origin.file && r.origin.name === origin.name);
    const hit = hits.find((r) => r.name === name) ?? hits[0];
    if (hit) byName[name] = { to: hit.specifier, name: hit.name };
    else missing.push(name);
  }
  if (missing.length > 0) return { missing };
  return { byName, to: [...new Set(Object.values(byName).map((t) => t.to))].join(", ") };
}

/**
 * @param {string} root repo の根
 * @param {{ base: string, head?: string }} opts
 * @returns {{ base: string, head: string, moved: {from: string, to: string}[], imports: {from: string, to: string, files: number, byName?: Record<string, {to: string, name: string}>}[], deleted: {from: string, file: string}[], unresolved: {from: string, file: string, lib: string}[] }}
 */
export function movedRows(root, { base, head = "HEAD" }) {
  const baseTree = new Set(git(root, ["ls-tree", "-r", "--name-only", base]).split("\n").filter(Boolean));
  const headTree = new Set(git(root, ["ls-tree", "-r", "--name-only", head]).split("\n").filter(Boolean));

  // 改名の表(<base> → <head>)
  const renames = new Map();
  for (const line of git(root, ["diff", "-M", "--name-status", base, head]).split("\n")) {
    const [status, from, to] = line.split("\t");
    if (status?.startsWith("R") && from && to) renames.set(from, to);
  }
  // <base>..<head> で変わったパス(lib の package.json が足された・変わったかを見る)
  const changed = new Set(git(root, ["diff", "--name-only", "--no-renames", base, head]).split("\n").filter(Boolean));

  const moved = [];
  for (const [from, to] of renames) {
    const lib = libOfPath(to);
    if (closedPkg(root, lib) && libOfPath(from) !== lib) moved.push({ from, to });
  }

  // <base> で使われていた "@/…" の指定子(ソースだけ。何か所で使われたか)
  const used = new Map();
  let grep = "";
  try {
    grep = git(root, ["grep", "-h", "-o", "-E", `["']@/[^"' ]+["']`, base, "--", ...SOURCE_EXTS.map((e) => `*.${e}`)]);
  } catch (error) {
    if (error.status !== 1) throw error; // 1 = 当たり無し
  }
  for (const line of grep.split("\n")) {
    // git grep は "<rev>:" を頭に付ける
    const text = line.startsWith(`${base}:`) ? line.slice(base.length + 1) : line;
    for (const m of text.matchAll(SPEC_RE)) used.set(m[1], (used.get(m[1]) ?? 0) + 1);
  }

  const imports = [];
  const deleted = [];
  const unresolved = [];
  const importer = path.join(root, "src/__moved__.ts");
  const reader = createExportReader(root);
  for (const [spec, files] of [...used].sort(([a], [b]) => a.localeCompare(b))) {
    const resolved = resolveImport(spec, importer, root);
    if (!resolved) continue;
    const baseFile = fileIn(baseTree, resolved);
    if (!baseFile) continue;
    const headFile = headTree.has(baseFile) ? baseFile : renames.get(baseFile);
    if (!headFile) {
      // 先が消え、改名も無い。閉じた lib に関わる物だけを出す
      const goneLib = libOfPath(baseFile);
      if (!closedPkg(root, goneLib)) continue;
      // 閉じた lib の中の束なら、名前ごとに今の入口へ
      const origins = barrelOrigins(root, base, baseFile, reader);
      const targets = origins ? barrelTargets(root, goneLib, origins, reader) : null;
      if (targets?.byName) imports.push({ from: spec, to: targets.to, files, byName: targets.byName });
      else if (targets?.missing) unresolved.push({ from: spec, file: baseFile, lib: goneLib });
      else deleted.push({ from: spec, file: baseFile });
      continue;
    }
    const lib = libOfPath(headFile);
    const pkg = closedPkg(root, lib);
    if (!pkg) continue;
    // <base> で既に閉じていた lib の中を、改名も無く読んでいた物 = この範囲の変更ではない
    if (headFile === baseFile && !changed.has(`${pkg.dir}/package.json`)) continue;
    const key = entryForFile(root, lib, headFile, reader) ?? entryForMarker(root, lib, headFile, reader);
    if (!key) {
      unresolved.push({ from: spec, file: headFile, lib });
      continue;
    }
    const to = entrySpecifier(root, lib, key);
    if (to !== spec) imports.push({ from: spec, to, files });
  }
  return { base, head, moved, imports, deleted, unresolved };
}

export function formatMoved(rows) {
  const join = (items, f) => items.map(f).join("; ");
  const out = [];
  out.push(`moved: ${rows.moved.length ? join(rows.moved, (r) => `${r.from} -> ${r.to}`) : "(なし)"}`);
  out.push(`imports: ${rows.imports.length ? join(rows.imports, (r) => `${r.from} -> ${r.to}`) : "(なし)"}`);
  if (rows.deleted.length) out.push(`deleted: ${join(rows.deleted, (r) => `${r.from} (${r.file})`)}`);
  if (rows.unresolved.length) out.push(`unresolved: ${join(rows.unresolved, (r) => `${r.from} (${r.file}: lib ${r.lib} のどの入口からも出ていない)`)}`);
  return out.join("\n");
}

export const MOVED_USAGE = "pnpm check lib-package -- moved --base <rev> [--head <rev>] [--json]";

/** CLI: exit 0 = 出した / 2 = 引数の誤り */
export function runMoved(root, argv, log = console.log) {
  const opts = { base: null, head: "HEAD", json: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--json") opts.json = true;
    else if (a === "--base" || a === "--head") opts[a.slice(2)] = argv[++i];
    else if (a.startsWith("--base=") || a.startsWith("--head=")) opts[a.slice(2, 6)] = a.slice(7);
    else {
      log(`lib-package moved: 知らない引数 ${a}(${MOVED_USAGE})`);
      return 2;
    }
  }
  if (!opts.base || !opts.head) {
    log(`lib-package moved: --base <rev> が要ります(${MOVED_USAGE})`);
    return 2;
  }
  for (const rev of [opts.base, opts.head]) {
    try {
      git(root, ["rev-parse", "--verify", "--quiet", `${rev}^{commit}`]);
    } catch {
      log(`lib-package moved: ${rev} は commit ではありません(${MOVED_USAGE})`);
      return 2;
    }
  }
  const rows = movedRows(root, opts);
  log(opts.json ? JSON.stringify(rows, null, 2) : formatMoved(rows));
  return 0;
}

