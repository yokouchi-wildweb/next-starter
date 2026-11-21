// scripts/structure/lib-package/codemod.mjs
//
// 閉じた lib(package.json を持ち、形の問題の無い lib)の中のファイルを外から読む import を、その名前を出す入口へ書き換える。
// 実行: pnpm check lib-package -- codemod [--apply] [--json](振り分けは check.mjs)。既定は dry-run。
// lib の名前を持たない: 木にある宣言(package.json の exports)だけを読むので、閉じた lib が増えればそのまま使える。
//
// - 入口の名前は exports の先のファイルから export を辿って求める(ローカルの宣言・import した名前の export・
//   export { a as b } from・export * from を再帰で。export * as ns は名前空間 1 つ)
// - 中を読む import の名前を同じく辿り、同じ実体を出す入口に向ける(同じ名前を優先、"." を優先、無ければ別名 { 入口の名前 as 元の名前 })。
//   1 文の名前が別の入口に分かれるなら入口ごとの文に分ける。import type・名前ごとの type は残す
// - 書き換えない(止まる一覧): notExported(入口から出ていない名前が 1 つでもある文は丸ごと)・default・namespace(import * as)・
//   exportAll(export * from / export * as)・sideEffect(import "x")・dynamic(import()・require)・unparsable(元のファイルが無い)
// - 走査するファイルは閉じたかの検査の数え方と同じ(closed.mjs の scanFiles)。lib の中のファイルは書き換えない
// - --base <rev>: moved の imports: の行(<rev> で使われていた指定子のうち、lib の外から閉じた lib へ移ったファイルを指す物 →
//   その入口。moved.mjs の movedRows を使う)も当てる。古い指定子は別名・相対・"src/…" のどの書き方でも実パスで照らす。
//   名前は新しい入口の名前と照らし、無ければ notExported。fork は notice に書かれた上流の sha を渡す
//   閉じる段で消した束(例 入口 "." にたたんだ src/lib/storage/client/index.ts)を読む import も、--base なら moved の行の
//   byName(束が出していた名前 → 今の入口)で名前ごとに書き換える(入口が分かれれば文を分ける)。--base なしは unparsable で止まる
// - 入口を読む文も見る(D262 名前ごとの割り): 入口から出ていった名前は、1 同じ lib の別の入口の同じ名前 → 2 (--base)<base> での
//   名前の実体を git の改名で今のファイルへ辿り、それを出す入口 → 3 その名前を出す閉じた lib の入口が 1 つ(実体が 1 つ)ならそれ、
//   の順で行き先を決め、入口ごとの文に分ける。決まらなければ ambiguous、どこにも無ければ notExported で止まる。
//   パッケージからの export * を持つ入口(名前を数えきれない)は触らない。中のファイルを読む文で、そのファイルに今も
//   ある名前は「入口から出していないだけ」なので行き先を探さない
// - 改名表(renames.json、renames.mjs): export の行 = 入口の名前の改名(import の名前を新しい名前にし、別名の無い import は
//   ファイルの中の参照も検査器の symbol で書き換える。lib の別の物と同じ名前は origin と --base で分ける)、method の行 =
//   TypeScript の型で受け手が lib の物と分かる呼び出しだけのメソッド名の書き換え(名前だけでは書き換えない、D266)
// - 改名の止まる一覧: needsBase(origin の行に --base が無い)・renamedReexport(改名する名前を出し直している)・nameTaken
//   (新しい名前がファイルに既にある)・untyped(受け手の型が分からない。報告だけ)
// - 移行の間だけの道具: 全部の lib が閉じた段(D101 (6))で moved とともに消す
// - exit 0(止まる物があっても。落とすのは pnpm lint の entry/only-entries)/ 2 = 引数の誤り

import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

import ts from "typescript";

import { resolveImport } from "../../../eslint-rules/resolve-import.mjs";
import { LIB_DIR, findEntry, libOfPath } from "../../../src/lib/libPackage/index.mjs";
import { listDeclaredLibs, readLibPackage } from "../../../src/lib/libPackage/node.mjs";
import { scanFiles } from "./closed.mjs";
import { movedRows } from "./moved.mjs";
import { bindingRenameEdits, loadRenames, planMethodRenames } from "./renames.mjs";

const EXTENSIONS = ["ts", "tsx", "mts", "mjs", "js", "jsx", "cjs"];
const EXT_RE = /\.(ts|tsx|mts|mjs|js|jsx|cjs)$/;
const toPosix = (p) => p.split(path.sep).join("/");

function scriptKindOf(file) {
  if (file.endsWith(".tsx")) return ts.ScriptKind.TSX;
  if (file.endsWith(".jsx")) return ts.ScriptKind.JSX;
  if (/\.(mjs|js|cjs)$/.test(file)) return ts.ScriptKind.JS;
  return ts.ScriptKind.TS;
}

/** 読む木: 既定は作業ツリー。gitTree(root, rev) は <rev> の版(--base の比べ) */
export const diskTree = (root) => ({ exists: onDisk(root), read: (rel) => readFileSync(path.join(root, rel), "utf8") });

export function gitTree(root, rev) {
  const files = new Set(execFileSync("git", ["ls-tree", "-r", "--name-only", rev], { cwd: root, encoding: "utf8", maxBuffer: 256 * 1024 * 1024 }).split("\n").filter(Boolean));
  const cache = new Map();
  return {
    exists: (rel) => files.has(rel),
    read: (rel) => {
      if (!cache.has(rel)) cache.set(rel, execFileSync("git", ["show", `${rev}:${rel}`], { cwd: root, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 }));
      return cache.get(rel);
    },
  };
}

/** JS のファイルの JSDoc の @typedef / @callback の名前(JS のファイルが出す型) */
function jsDocTypeNames(sf) {
  const names = [];
  const collect = (node) => {
    for (const doc of node.jsDoc ?? []) {
      for (const tag of doc.tags ?? []) {
        if ((ts.isJSDocTypedefTag(tag) || ts.isJSDocCallbackTag(tag)) && tag.name && ts.isIdentifier(tag.name)) names.push(tag.name.text);
      }
    }
  };
  for (const st of sf.statements) collect(st);
  collect(sf.endOfFileToken);
  return names;
}

/** export const { a, b: c } = … の束縛名 */
function bindingNames(name, out = []) {
  if (ts.isIdentifier(name)) out.push(name.text);
  else for (const el of name.elements) if (!ts.isOmittedExpression(el)) bindingNames(el.name, out);
  return out;
}

const onDisk = (root) => (rel) => existsSync(path.join(root, rel));

/** 解いたパス(拡張子・index の有無を問わない)を実在するファイル(repo 相対)に。無ければ null。exists = 木(既定は作業ツリー) */
export function probeFile(root, resolved, exists = onDisk(root)) {
  if (!resolved) return null;
  const candidates = EXT_RE.test(resolved) ? [resolved] : [];
  for (const ext of EXTENSIONS) candidates.push(`${resolved}.${ext}`);
  for (const ext of EXTENSIONS) candidates.push(`${resolved}/index.${ext}`);
  // "./x.js" と書いて x.ts を指す書き方
  if (EXT_RE.test(resolved)) for (const ext of EXTENSIONS) candidates.push(resolved.replace(EXT_RE, `.${ext}`));
  return candidates.find((c) => !c.endsWith("/") && exists(c)) ?? null;
}

const hasModifier = (node, kind) => Boolean(ts.canHaveModifiers(node) && ts.getModifiers(node)?.some((m) => m.kind === kind));

/** 1 つの repo の export の辿り(ファイルごとに覚える) */
export function createExportReader(root, tree = diskTree(root)) {
  const memo = new Map();
  const opaque = new Set(); // 名前を全部は数えられないファイル(パッケージからの export * を持つ)

  const resolveFrom = (rel, spec) => probeFile(root, resolveImport(spec, path.join(root, rel), root), tree.exists);

  /** ファイルの export 名 → 実体 { file, name }(file = repo 相対、パッケージなら指定子)。読めなければ null */
  function exportsOf(rel, seen = new Set()) {
    if (memo.has(rel)) return memo.get(rel);
    if (seen.has(rel)) return new Map();
    seen.add(rel);
    if (!rel || !tree.exists(rel)) return null;
    const sf = ts.createSourceFile(rel, tree.read(rel), ts.ScriptTarget.Latest, true, scriptKindOf(rel));
    const out = new Map();
    const imported = new Map();
    const follow = (spec, name) => {
      const file = resolveFrom(rel, spec);
      if (!file) return { file: spec, name };
      if (name === "*") return { file, name: "*" };
      return exportsOf(file, seen)?.get(name) ?? { file, name };
    };
    for (const st of sf.statements) {
      if (ts.isImportDeclaration(st) && st.importClause && ts.isStringLiteral(st.moduleSpecifier)) {
        const spec = st.moduleSpecifier.text;
        const clause = st.importClause;
        if (clause.name) imported.set(clause.name.text, { spec, name: "default" });
        const bindings = clause.namedBindings;
        if (bindings && ts.isNamespaceImport(bindings)) imported.set(bindings.name.text, { spec, name: "*" });
        if (bindings && ts.isNamedImports(bindings)) {
          for (const el of bindings.elements) imported.set(el.name.text, { spec, name: (el.propertyName ?? el.name).text });
        }
      }
    }
    for (const st of sf.statements) {
      if (ts.isExportDeclaration(st)) {
        const spec = st.moduleSpecifier && ts.isStringLiteral(st.moduleSpecifier) ? st.moduleSpecifier.text : null;
        const clause = st.exportClause;
        if (spec && !clause) {
          const file = resolveFrom(rel, spec);
          const names = file ? exportsOf(file, seen) : null;
          if (!names || opaque.has(file)) opaque.add(rel);
          for (const [name, origin] of names ?? []) if (name !== "default" && !out.has(name)) out.set(name, origin);
        } else if (spec && clause && ts.isNamespaceExport(clause)) {
          out.set(clause.name.text, follow(spec, "*"));
        } else if (clause && ts.isNamedExports(clause)) {
          for (const el of clause.elements) {
            const local = (el.propertyName ?? el.name).text;
            const exported = el.name.text;
            if (spec) out.set(exported, follow(spec, local));
            else if (imported.has(local)) out.set(exported, follow(imported.get(local).spec, imported.get(local).name));
            else out.set(exported, { file: rel, name: local });
          }
        }
        continue;
      }
      if (ts.isExportAssignment(st)) {
        out.set("default", { file: rel, name: "default" });
        continue;
      }
      if (!hasModifier(st, ts.SyntaxKind.ExportKeyword)) continue;
      const isDefault = hasModifier(st, ts.SyntaxKind.DefaultKeyword);
      if (ts.isVariableStatement(st)) {
        for (const decl of st.declarationList.declarations) {
          for (const name of bindingNames(decl.name)) out.set(name, { file: rel, name });
        }
      } else if (st.name && ts.isIdentifier(st.name)) {
        out.set(isDefault ? "default" : st.name.text, { file: rel, name: isDefault ? "default" : st.name.text });
      } else if (isDefault) {
        out.set("default", { file: rel, name: "default" });
      }
    }
    if (/\.(mjs|js|cjs|jsx)$/.test(rel)) for (const name of jsDocTypeNames(sf)) if (!out.has(name)) out.set(name, { file: rel, name });
    memo.set(rel, out);
    return out;
  }

  /** 名前を全部数えられたか(パッケージからの export * を辿れなかったファイルは false) */
  const complete = (rel) => {
    exportsOf(rel);
    return !opaque.has(rel);
  };

  return { exportsOf, resolveFrom, complete };
}

const sameOrigin = (a, b) => a.file === b.file && a.name === b.name;

/**
 * 入口の指定子。JS の入口(.mjs / .js)はファイル名まで書く(TS はフォルダの index.mjs を解かない。例 `@/lib/pathPattern/index.mjs`)
 * @param {{ key: string, keyPath: string, targetPath: string }} entry
 */
export function specifierOfEntry(lib, entry) {
  if (/\.(mjs|js)$/.test(entry.targetPath)) return `@/lib/${lib}/${entry.targetPath}`;
  return entry.key === "." ? `@/lib/${lib}` : `@/lib/${lib}/${entry.keyPath}`;
}

/** 入口の鍵からの指定子(鍵が package.json に無ければ鍵の形から作る) */
export function entrySpecifier(root, lib, key) {
  const pkg = readLibPackage(root, lib);
  const entry = pkg?.exports.find((e) => e.key === key);
  if (entry) return specifierOfEntry(lib, entry);
  return key === "." ? `@/lib/${lib}` : `@/lib/${lib}/${key.replace(/^\.\//, "")}`;
}

/** lib の入口ごとの名前: [{ key, specifier, name, origin }]("." が先、その後は exports の順) */
export function entryIndex(root, lib, reader = createExportReader(root)) {
  const pkg = readLibPackage(root, lib);
  if (!pkg || pkg.problems.length > 0) return [];
  const rows = [];
  const keys = [...pkg.exports].sort((a, b) => (a.key === "." ? -1 : b.key === "." ? 1 : 0));
  for (const entry of keys) {
    const specifier = specifierOfEntry(lib, entry);
    const names = reader.exportsOf(`${pkg.dir}/${entry.targetPath}`);
    for (const [name, origin] of names ?? []) rows.push({ key: entry.key, specifier, name, origin });
  }
  return rows;
}

/** 中のファイル(repo 相対、拡張子は有無を問わない)の物を出す入口の鍵。無ければ null(moved の道具と同じ答え) */
export function entryForFile(root, lib, file, reader = createExportReader(root)) {
  const pkg = readLibPackage(root, lib);
  if (!pkg || pkg.problems.length > 0) return null;
  const direct = findEntry(pkg, toPosix(file));
  if (direct) return direct.key;
  const real = probeFile(root, toPosix(file).replace(EXT_RE, ""));
  if (!real) return null;
  const row = entryIndex(root, lib, reader).find((r) => r.origin.file === real);
  return row ? row.key : null;
}

/** 中を読む名前 1 つの行き先: { specifier, name } か null */
function targetOf(index, origin, localName) {
  const hits = index.filter((r) => sameOrigin(r.origin, origin));
  return hits.find((r) => r.name === localName) ?? hits[0] ?? null;
}

function lineOf(sf, node) {
  return sf.getLineAndCharacterOfPosition(node.getStart(sf)).line + 1;
}

/** 文を書く: keyword = import | export、items = [{ name, local, isType }] */
function statementText(keyword, typeOnly, items, specifier) {
  const list = items.map((it) => `${it.isType ? "type " : ""}${it.name}${it.name !== it.local ? ` as ${it.local}` : ""}`).join(", ");
  return `${keyword}${typeOnly ? " type" : ""} { ${list} } from "${specifier}";`;
}

const bare = (p) => p.replace(EXT_RE, "").replace(/\/index$/, "");

/** JS のファイル(素の node で動く道具)が相対で読んでいたら、入口の指定子(`@/lib/…`)も相対にする(素の node は `@/` を解かない) */
function localizeSpecifier(file, original, specifier) {
  if (!/\.(mjs|js|cjs)$/.test(file) || !original.startsWith(".") || !specifier.startsWith("@/")) return specifier;
  const rel = toPosix(path.relative(path.posix.dirname(file), `src/${specifier.slice(2)}`));
  return rel.startsWith(".") ? rel : `./${rel}`;
}

/**
 * 書き換えの計画を作る(ファイルは書かない)
 * @param {{ base?: string, table?: ReturnType<typeof loadRenames> }} [opts] base = moved の imports: の行と、名前の <base> での実体を引く比べの起点。
 *   table = 改名表(既定 renames.json)
 * @returns {{ scanned: number, rows: { from, to }[], changes: { file, line, from, to, names, start, end, text }[], stops: { file, line, specifier, kind, detail }[] }}
 */
export function planCodemod(root, { base, table = loadRenames() } = {}) {
  const reader = createExportReader(root);
  const closed = new Map();
  for (const lib of listDeclaredLibs(root)) {
    const pkg = readLibPackage(root, lib);
    if (pkg.problems.length === 0) closed.set(lib, pkg);
  }
  const indexes = new Map();
  const indexOf = (lib) => {
    if (!indexes.has(lib)) indexes.set(lib, entryIndex(root, lib, reader));
    return indexes.get(lib);
  };
  let allRows = null;
  const everyEntryRow = () => (allRows ??= [...closed.keys()].flatMap((lib) => indexOf(lib)));
  // 古い指定子の行: 古い実パス(拡張子・index なし)→ { from, to, lib }。中を読む import として扱える物は先にそちらで当たる
  const rows = base && closed.size > 0 ? movedRows(root, { base }).imports.map(({ from, to, byName }) => (byName ? { from, to, byName } : { from, to })) : [];
  const rowByPath = new Map();
  for (const row of rows) {
    const resolved = resolveImport(row.from, path.join(root, "src/__codemod__.ts"), root);
    const lib = libOfPath(resolveImport(row.to.split(", ")[0], path.join(root, "src/__codemod__.ts"), root) ?? "");
    if (resolved && lib) rowByPath.set(bare(resolved), { ...row, lib });
  }
  // <base> の木: 名前の実体をそこで引き、改名(<base> → 作業ツリー)で今のファイルへ
  const baseTree = base && closed.size > 0 ? gitTree(root, base) : null;
  const baseReader = baseTree ? createExportReader(root, baseTree) : null;
  const renamed = new Map();
  if (baseTree) {
    for (const line of execFileSync("git", ["diff", "-M", "--name-status", base], { cwd: root, encoding: "utf8", maxBuffer: 256 * 1024 * 1024 }).split("\n")) {
      const [status, from, to] = line.split("\t");
      if (status?.startsWith("R") && from && to) renamed.set(from, to);
    }
  }
  const exportRows = table.filter((row) => row.kind === "export");

  const changes = [];
  const stops = [];
  const files = closed.size === 0 ? [] : scanFiles(root);
  for (const file of files) {
    const importerLib = libOfPath(file);
    const abs = path.join(root, file);
    const text = readFileSync(abs, "utf8");
    if (rows.length === 0 && ![...closed.keys()].some((lib) => text.includes(lib))) continue;
    const sf = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, scriptKindOf(file));

    /**
     * 指定子が閉じた lib の入口なら { lib, resolved, entry }、中(入口でない)なら { lib, resolved }、古い指定子の行に当たれば { lib, row }、でなければ null
     */
    const innerOf = (spec) => {
      if (spec.startsWith("@lib-config/")) return null;
      const resolved = resolveImport(spec, abs, root);
      if (!resolved) return null;
      const lib = libOfPath(resolved);
      if (lib && closed.has(lib)) {
        if (lib === importerLib) return null;
        const entry = findEntry(closed.get(lib), resolved);
        if (entry) return { lib, resolved, entry };
        // 消えた束(今の木に無いファイル)は --base の行で名前ごとに引く
        const goneRow = probeFile(root, resolved) ? null : rowByPath.get(bare(resolved));
        if (goneRow?.byName) return { lib, row: goneRow };
        return { lib, resolved };
      }
      const row = rowByPath.get(bare(resolved));
      if (row && row.lib !== importerLib) return { lib: row.lib, row };
      return null;
    };
    const stop = (node, specifier, kind, detail) => stops.push({ file, line: lineOf(sf, node), specifier, kind, detail });

    /** <base> の木で、この指定子から読んだ名前の実体 { file, name }(読めなければ null) */
    const baseOrigin = (spec, name) => {
      if (!baseReader) return null;
      const baseFile = probeFile(root, resolveImport(spec, abs, root), baseTree.exists);
      const origin = baseFile ? baseReader.exportsOf(baseFile)?.get(name) : null;
      return origin && baseTree.exists(origin.file) ? origin : null;
    };

    /**
     * 入口から出ていった名前の行き先(D262 名前ごとの割り): 1 同じ lib の別の入口の同じ名前 → 2 (--base)<base> での名前の実体を
     * 改名で今のファイルへ辿り、それを出す入口 → 3 その名前を出す閉じた lib の入口が 1 つ(実体が 1 つ)ならそれ
     * @returns {{ target } | { ambiguous: string[] } | null}
     */
    const findHome = (lib, spec, oldName, wanted) => {
      const same = indexOf(lib).find((r) => r.name === wanted);
      if (same) return { target: same };
      const origin = baseOrigin(spec, oldName);
      if (origin) {
        const now = existsSync(path.join(root, origin.file)) ? origin.file : renamed.get(origin.file);
        const hits = now ? everyEntryRow().filter((r) => r.origin.file === now && (r.origin.name === origin.name || r.origin.name === wanted)) : [];
        const hit = hits.find((r) => r.name === wanted) ?? hits[0];
        if (hit) return { target: hit };
      }
      const named = everyEntryRow().filter((r) => r.name === wanted);
      const origins = new Set(named.map((r) => `${r.origin.file}#${r.origin.name}`));
      if (origins.size === 1) return { target: named[0] };
      if (origins.size > 1) return { ambiguous: [...new Set(named.map((r) => r.specifier))] };
      return null;
    };

    /** 改名表の export の行(lib から読んだ名前 oldName が改名された物)。origin の行は --base の実体で照らす */
    const exportRowFor = (lib, spec, oldName) => {
      const candidates = exportRows.filter((row) => row.lib === lib && row.from === oldName);
      for (const row of candidates) {
        if (row.origin === undefined) return { row };
        if (!baseReader) return { needsBase: row };
        if (baseOrigin(spec, oldName)?.file === row.origin) return { row };
      }
      return null;
    };

    const visit = (node) => {
      if (ts.isCallExpression(node)) {
        const [arg] = node.arguments;
        const isImport = node.expression.kind === ts.SyntaxKind.ImportKeyword;
        const isRequire = ts.isIdentifier(node.expression) && node.expression.text === "require";
        const inner = (isImport || isRequire) && arg && ts.isStringLiteralLike(arg) ? innerOf(arg.text) : null;
        if (inner && !inner.entry) stop(node, arg.text, "dynamic", isImport ? "import()" : "require()");
      }
      ts.forEachChild(node, visit);
    };

    const bindingRenames = [];
    for (const st of sf.statements) {
      const isImport = ts.isImportDeclaration(st);
      const isExport = ts.isExportDeclaration(st);
      if (!(isImport || isExport) || !st.moduleSpecifier || !ts.isStringLiteral(st.moduleSpecifier)) {
        visit(st);
        continue;
      }
      const spec = st.moduleSpecifier.text;
      const inner = innerOf(spec);
      if (!inner) continue;

      // 入口を読む文: 名前が全部その入口から出ていれば触らない(数えられない入口も触らない)
      let entryNames = null;
      if (inner.entry) {
        const entryFile = `${closed.get(inner.lib).dir}/${inner.entry.targetPath}`;
        if (!reader.complete(entryFile)) continue;
        entryNames = reader.exportsOf(entryFile) ?? new Map();
      }

      let items;
      let typeOnly;
      if (isImport) {
        const clause = st.importClause;
        if (!clause) {
          if (!inner.entry) stop(st, spec, "sideEffect", "名前を受け取らない import");
          continue;
        }
        if (inner.entry && (clause.name || (clause.namedBindings && ts.isNamespaceImport(clause.namedBindings)))) continue;
        if (clause.name) {
          stop(st, spec, "default", `default import ${clause.name.text}`);
          continue;
        }
        if (clause.namedBindings && ts.isNamespaceImport(clause.namedBindings)) {
          stop(st, spec, "namespace", `import * as ${clause.namedBindings.name.text}`);
          continue;
        }
        typeOnly = clause.isTypeOnly;
        items = (clause.namedBindings?.elements ?? []).map((el) => ({ inner: (el.propertyName ?? el.name).text, local: el.name.text, isType: el.isTypeOnly }));
      } else {
        if (!st.exportClause || ts.isNamespaceExport(st.exportClause)) {
          if (!inner.entry) stop(st, spec, "exportAll", st.exportClause ? `export * as ${st.exportClause.name.text}` : "export *");
          continue;
        }
        typeOnly = st.isTypeOnly;
        items = st.exportClause.elements.map((el) => ({ inner: (el.propertyName ?? el.name).text, local: el.name.text, isType: el.isTypeOnly }));
      }
      if (inner.entry && items.every((item) => entryNames.has(item.inner))) continue;

      const index = indexOf(inner.lib);
      let names = null;
      let innerFile = null;
      if (!inner.row && !inner.entry) {
        innerFile = probeFile(root, inner.resolved);
        names = innerFile ? reader.exportsOf(innerFile) : null;
        if (!names) {
          stop(st, spec, "unparsable", `中のファイル ${inner.resolved} を読めない${base ? "" : "。閉じる段で消した束なら --base <rev> で名前ごとに引ける"}`);
          continue;
        }
      }
      const missing = [];
      const problems = [];
      const renames = [];
      const byEntry = new Map();
      const place = (specifier, item) => {
        const list = byEntry.get(specifier) ?? [];
        list.push(item);
        byEntry.set(specifier, list);
      };
      for (const item of items) {
        if (inner.entry && entryNames.has(item.inner)) {
          place(spec, { name: item.inner, local: item.local, isType: item.isType });
          continue;
        }
        const byName = inner.row?.byName?.[item.inner];
        let target = inner.entry
          ? null
          : byName
          ? index.find((r) => r.specifier === byName.to && r.name === byName.name) ?? null
          : inner.row
          ? index.find((r) => r.specifier === inner.row.to && r.name === item.inner) ?? null
          : names.has(item.inner)
          ? targetOf(index, names.get(item.inner), item.inner)
          : null;
        let local = item.local;
        // 読んだ中のファイルに今もある名前 = 入口から出していないだけ(出ていった名前ではない)。行き先は探さない
        const stillThere = Boolean(names?.has(item.inner));
        if (!target && !stillThere) {
          const renameHit = exportRowFor(inner.lib, spec, item.inner);
          if (renameHit?.needsBase) {
            problems.push(["needsBase", `${item.inner} は改名表で lib の別の物と分ける行(origin ${renameHit.needsBase.origin})。--base <rev> が要る`]);
            continue;
          }
          const wanted = renameHit?.row.to ?? item.inner;
          if (renameHit) {
            if (!isImport) {
              problems.push(["renamedReexport", `${item.inner} → ${wanted} の改名を出し直している(出す名前を変えると読み手が壊れる。手で決める)`]);
              continue;
            }
            if (item.local === item.inner) {
              if (new RegExp(`\\b${wanted}\\b`).test(text)) {
                problems.push(["nameTaken", `${item.inner} → ${wanted}: このファイルに ${wanted} が既にある`]);
                continue;
              }
              local = wanted;
              renames.push({ from: item.inner, to: wanted });
            }
          }
          const home = findHome(inner.lib, spec, item.inner, wanted);
          if (home?.ambiguous) {
            problems.push(["ambiguous", `${wanted} を出す入口が 1 つに決まらない: ${home.ambiguous.join(", ")}`]);
            continue;
          }
          target = home?.target ?? null;
        }
        if (!target) {
          missing.push(item.inner);
          continue;
        }
        place(localizeSpecifier(file, spec, target.specifier), { name: target.name, local, isType: item.isType });
      }
      if (problems.length > 0) {
        for (const [kind, detail] of problems) stop(st, spec, kind, detail);
        continue;
      }
      if (missing.length > 0) {
        stop(st, spec, "notExported", `入口から出ていない名前: ${missing.join(", ")}`);
        continue;
      }
      if (items.length === 0) continue;
      bindingRenames.push(...renames);
      const indent = text.slice(text.lastIndexOf("\n", st.getStart(sf) - 1) + 1, st.getStart(sf));
      const keyword = isImport ? "import" : "export";
      const newText = [...byEntry.entries()].map(([specifier, list]) => statementText(keyword, typeOnly, list, specifier)).join(`\n${/^\s*$/.test(indent) ? indent : ""}`);
      changes.push({
        file,
        line: lineOf(sf, st),
        from: spec,
        to: [...byEntry.keys()].join(", "),
        names: items.map((it) => it.local),
        start: st.getStart(sf),
        end: st.end,
        text: newText,
      });
    }
    if (bindingRenames.length > 0) {
      const bound = bindingRenameEdits(root, file, text, bindingRenames);
      for (const edit of bound.edits) {
        const rename = bindingRenames.find((r) => r.to === edit.text || edit.text.endsWith(`: ${r.to}`));
        changes.push({ file, line: edit.line, from: rename?.from ?? "", to: rename?.to ?? edit.text, names: [rename?.from ?? ""], start: edit.start, end: edit.end, text: edit.text });
      }
      for (const s of bound.stops) stops.push({ file, line: s.line, specifier: s.name, kind: "renamedReexport", detail: s.detail });
    }
  }
  const methods = planMethodRenames(root, files, table);
  changes.push(...methods.changes);
  stops.push(...methods.stops);
  return { scanned: files.length, rows, changes, stops };
}

/** 計画をファイルに書く(後ろから置き換えるので位置がずれない) */
export function applyCodemod(root, plan) {
  const byFile = new Map();
  for (const change of plan.changes) {
    const list = byFile.get(change.file) ?? [];
    list.push(change);
    byFile.set(change.file, list);
  }
  for (const [file, list] of byFile) {
    const abs = path.join(root, file);
    let text = readFileSync(abs, "utf8");
    for (const change of [...list].sort((a, b) => b.start - a.start)) {
      text = text.slice(0, change.start) + change.text + text.slice(change.end);
    }
    writeFileSync(abs, text);
  }
  return [...byFile.keys()];
}

const USAGE = "pnpm check lib-package -- codemod [--base <rev>] [--apply] [--json]";

/** check.mjs の `-- codemod` から呼ぶ。exit code を返す */
export function runCodemod(root, argv = [], { stdout = process.stdout } = {}) {
  const flags = new Set();
  let base;
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--apply" || arg === "--json") flags.add(arg);
    else if (arg === "--base" && argv[i + 1] && !argv[i + 1].startsWith("--")) base = argv[++i];
    else if (arg.startsWith("--base=") && arg.length > 7) base = arg.slice(7);
    else if (arg !== "--") {
      stdout.write(`lib-package codemod: 知らない引数 ${arg}(${USAGE})\n`);
      return 2;
    }
  }
  const apply = flags.has("--apply");
  let table;
  try {
    table = loadRenames();
  } catch (error) {
    stdout.write(`lib-package codemod: 改名表 renames.json の誤り: ${error.message}\n`);
    return 2;
  }
  const plan = planCodemod(root, { base, table });
  if (apply) applyCodemod(root, plan);
  if (flags.has("--json")) {
    const strip = ({ start, end, text, ...rest }) => ({ ...rest, text });
    stdout.write(`${JSON.stringify({ apply, base: base ?? null, scanned: plan.scanned, rows: plan.rows, changes: plan.changes.map(strip), stops: plan.stops }, null, 2)}\n`);
    return 0;
  }
  for (const c of plan.changes) stdout.write(`${c.file}:${c.line} ${c.from} -> ${c.to} { ${c.names.join(", ")} }\n`);
  for (const s of plan.stops) stdout.write(`止まる ${s.kind} ${s.file}:${s.line} ${s.specifier}(${s.detail})\n`);
  const files = new Set(plan.changes.map((c) => c.file)).size;
  stdout.write(
    `lib-package codemod: ${apply ? "書き換えた" : "書き換える(dry-run、書くのは --apply)"} ${plan.changes.length} 文 / ${files} ファイル・止まる ${plan.stops.length}(走査 ${plan.scanned}、閉じた lib の中: ${LIB_DIR}/<名前>${base ? `、古い指定子の行 ${plan.rows.length}(--base ${base})` : ""})\n`,
  );
  return 0;
}
