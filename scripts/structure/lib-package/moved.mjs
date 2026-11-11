// scripts/structure/lib-package/moved.mjs
//
// pnpm check lib-package -- moved --base <rev> [--head <rev>] [--json]
// 閉じた lib への付け替えの表(notice の材料)を、宣言と git の差分から出す。lib の名前は持たない(閉じた lib が増えればそのまま使える)。
// - moved:  ファイルの行(notice の moved: 欄、/flux が fork の編集を移す)= <base>→<head> で git が改名と見た行のうち、
//           新しいパスが閉じた lib の中で、古いパスがその lib の外の物
// - imports: 指定子の行(notice の notes: と codemod の手順)= <base> で使われていた "@/…" の指定子が、<head> では閉じた lib の
//           入口でない中のファイルを指す物 → その名前を出す入口(codemod.mjs の entryForFile と同じ求め方)
// - deleted: <base> の指定子の先が <head> で消え、改名も無い物(推し量らない。notes: に書く材料)
// 行にするのは <base>..<head> の変更で生まれた物だけ: imports: / unresolved: は、指定子の先のファイルが改名されたか、
// その lib の package.json が <base>..<head> で足された・変わった物(<base> で既に閉じていた lib の中を読む古い書き方は出さない)
// 印のファイル(入口を re-export するためだけに残したファイル。例 src/lib/drizzle/transaction.ts)は re-export を辿って入口を求める
// 閉じた lib = 作業ツリーで package.json を持ち形に問題の無い lib(宣言は作業ツリーから読む。--head は改名の比べ先)。

import { execFileSync } from "node:child_process";
import path from "node:path";

import { resolveImport } from "../../../eslint-rules/resolve-import.mjs";
import { libOfPath, readLibPackage } from "../../../src/lib/libPackage/index.mjs";
import { createExportReader, entryForFile, entryIndex, probeFile } from "./codemod.mjs";

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
const entrySpecifier = (lib, key) => (key === "." ? `@/lib/${lib}` : `@/lib/${lib}/${key.replace(/^\.\//, "")}`);

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
 * @param {string} root repo の根
 * @param {{ base: string, head?: string }} opts
 * @returns {{ base: string, head: string, moved: {from: string, to: string}[], imports: {from: string, to: string, files: number}[], deleted: {from: string, file: string}[], unresolved: {from: string, file: string, lib: string}[] }}
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
      if (closedPkg(root, libOfPath(baseFile))) deleted.push({ from: spec, file: baseFile });
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
    const to = entrySpecifier(lib, key);
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

