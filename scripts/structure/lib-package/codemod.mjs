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
// - 移行の間だけの道具: 全部の lib が閉じた段(D101 (6))で moved とともに消す
// - exit 0(止まる物があっても。落とすのは pnpm lint の lib-entry)/ 2 = 引数の誤り

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

import ts from "typescript";

import { resolveImport } from "../../../eslint-rules/resolve-import.mjs";
import { LIB_DIR, findEntry, libOfPath, listDeclaredLibs, readLibPackage } from "../../../src/lib/libPackage/index.mjs";
import { scanFiles } from "./closed.mjs";
import { movedRows } from "./moved.mjs";

const EXTENSIONS = ["ts", "tsx", "mts", "mjs", "js", "jsx", "cjs"];
const EXT_RE = /\.(ts|tsx|mts|mjs|js|jsx|cjs)$/;
const toPosix = (p) => p.split(path.sep).join("/");

function scriptKindOf(file) {
  if (file.endsWith(".tsx")) return ts.ScriptKind.TSX;
  if (file.endsWith(".jsx")) return ts.ScriptKind.JSX;
  if (/\.(mjs|js|cjs)$/.test(file)) return ts.ScriptKind.JS;
  return ts.ScriptKind.TS;
}

function parse(root, rel) {
  const text = readFileSync(path.join(root, rel), "utf8");
  return { text, sf: ts.createSourceFile(rel, text, ts.ScriptTarget.Latest, true, scriptKindOf(rel)) };
}

/** 解いたパス(拡張子・index の有無を問わない)を実在するファイル(repo 相対)に。無ければ null */
export function probeFile(root, resolved) {
  if (!resolved) return null;
  const candidates = EXT_RE.test(resolved) ? [resolved] : [];
  for (const ext of EXTENSIONS) candidates.push(`${resolved}.${ext}`);
  for (const ext of EXTENSIONS) candidates.push(`${resolved}/index.${ext}`);
  // "./x.js" と書いて x.ts を指す書き方
  if (EXT_RE.test(resolved)) for (const ext of EXTENSIONS) candidates.push(resolved.replace(EXT_RE, `.${ext}`));
  return candidates.find((c) => existsSync(path.join(root, c)) && !c.endsWith("/")) ?? null;
}

const hasModifier = (node, kind) => Boolean(ts.canHaveModifiers(node) && ts.getModifiers(node)?.some((m) => m.kind === kind));

/** 1 つの repo の export の辿り(ファイルごとに覚える) */
export function createExportReader(root) {
  const memo = new Map();

  const resolveFrom = (rel, spec) => probeFile(root, resolveImport(spec, path.join(root, rel), root));

  /** ファイルの export 名 → 実体 { file, name }(file = repo 相対、パッケージなら指定子)。読めなければ null */
  function exportsOf(rel, seen = new Set()) {
    if (memo.has(rel)) return memo.get(rel);
    if (seen.has(rel)) return new Map();
    seen.add(rel);
    if (!rel || !existsSync(path.join(root, rel))) return null;
    const { sf } = parse(root, rel);
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
          if (ts.isIdentifier(decl.name)) out.set(decl.name.text, { file: rel, name: decl.name.text });
        }
      } else if (st.name && ts.isIdentifier(st.name)) {
        out.set(isDefault ? "default" : st.name.text, { file: rel, name: isDefault ? "default" : st.name.text });
      } else if (isDefault) {
        out.set("default", { file: rel, name: "default" });
      }
    }
    memo.set(rel, out);
    return out;
  }

  return { exportsOf, resolveFrom };
}

const sameOrigin = (a, b) => a.file === b.file && a.name === b.name;

/** lib の入口ごとの名前: [{ key, specifier, name, origin }]("." が先、その後は exports の順) */
export function entryIndex(root, lib, reader = createExportReader(root)) {
  const pkg = readLibPackage(root, lib);
  if (!pkg || pkg.problems.length > 0) return [];
  const rows = [];
  const keys = [...pkg.exports].sort((a, b) => (a.key === "." ? -1 : b.key === "." ? 1 : 0));
  for (const entry of keys) {
    const specifier = entry.key === "." ? `@/lib/${lib}` : `@/lib/${lib}/${entry.keyPath}`;
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

/**
 * 書き換えの計画を作る(ファイルは書かない)
 * @param {{ base?: string }} [opts] base = moved の imports: の行を当てる比べの起点(無ければ中を読む import だけ)
 * @returns {{ scanned: number, rows: { from, to }[], changes: { file, line, from, to, names, start, end, text }[], stops: { file, line, specifier, kind, detail }[] }}
 */
export function planCodemod(root, { base } = {}) {
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
  // 古い指定子の行: 古い実パス(拡張子・index なし)→ { from, to, lib }。中を読む import として扱える物は先にそちらで当たる
  const rows = base && closed.size > 0 ? movedRows(root, { base }).imports.map(({ from, to }) => ({ from, to })) : [];
  const rowByPath = new Map();
  for (const row of rows) {
    const resolved = resolveImport(row.from, path.join(root, "src/__codemod__.ts"), root);
    const lib = libOfPath(resolveImport(row.to, path.join(root, "src/__codemod__.ts"), root) ?? "");
    if (resolved && lib) rowByPath.set(bare(resolved), { ...row, lib });
  }
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
     * 指定子が閉じた lib の中(入口でない)なら { lib, resolved }、古い指定子の行に当たれば { lib, row }、でなければ null
     */
    const innerOf = (spec) => {
      if (spec.startsWith("@lib-config/")) return null;
      const resolved = resolveImport(spec, abs, root);
      if (!resolved) return null;
      const lib = libOfPath(resolved);
      if (lib && closed.has(lib)) {
        if (lib === importerLib || findEntry(closed.get(lib), resolved)) return null;
        return { lib, resolved };
      }
      const row = rowByPath.get(bare(resolved));
      if (row && row.lib !== importerLib) return { lib: row.lib, row };
      return null;
    };
    const stop = (node, specifier, kind, detail) => stops.push({ file, line: lineOf(sf, node), specifier, kind, detail });

    const visit = (node) => {
      if (ts.isCallExpression(node)) {
        const [arg] = node.arguments;
        const isImport = node.expression.kind === ts.SyntaxKind.ImportKeyword;
        const isRequire = ts.isIdentifier(node.expression) && node.expression.text === "require";
        if ((isImport || isRequire) && arg && ts.isStringLiteralLike(arg) && innerOf(arg.text)) {
          stop(node, arg.text, "dynamic", isImport ? "import()" : "require()");
        }
      }
      ts.forEachChild(node, visit);
    };

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

      let items;
      let typeOnly;
      if (isImport) {
        const clause = st.importClause;
        if (!clause) {
          stop(st, spec, "sideEffect", "名前を受け取らない import");
          continue;
        }
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
          stop(st, spec, "exportAll", st.exportClause ? `export * as ${st.exportClause.name.text}` : "export *");
          continue;
        }
        typeOnly = st.isTypeOnly;
        items = st.exportClause.elements.map((el) => ({ inner: (el.propertyName ?? el.name).text, local: el.name.text, isType: el.isTypeOnly }));
      }

      const index = indexOf(inner.lib);
      let names = null;
      let innerFile = null;
      if (inner.row) {
        // 古い指定子: 新しい入口の名前と照らす(元のファイルは移って無い)
      } else {
        innerFile = probeFile(root, inner.resolved);
        names = innerFile ? reader.exportsOf(innerFile) : null;
        if (!names) {
          stop(st, spec, "unparsable", `中のファイル ${inner.resolved} を読めない`);
          continue;
        }
      }
      const missing = [];
      const byEntry = new Map();
      for (const item of items) {
        const target = inner.row
          ? index.find((r) => r.specifier === inner.row.to && r.name === item.inner) ?? null
          : targetOf(index, names.get(item.inner) ?? { file: innerFile, name: item.inner }, item.inner);
        if (!target) {
          missing.push(item.inner);
          continue;
        }
        const list = byEntry.get(target.specifier) ?? [];
        list.push({ name: target.name, local: item.local, isType: item.isType });
        byEntry.set(target.specifier, list);
      }
      if (missing.length > 0) {
        stop(st, spec, "notExported", `入口から出ていない名前: ${missing.join(", ")}`);
        continue;
      }
      if (items.length === 0) continue;
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
  }
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
  const plan = planCodemod(root, { base });
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
