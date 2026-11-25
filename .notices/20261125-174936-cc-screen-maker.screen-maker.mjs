#!/usr/bin/env node
// .notices/20261125-174936-cc-screen-maker.screen-maker.mjs
// 区切り cc-screen-maker の移し替えの道具(画面の作り手 createScreen、D110・D119)。上流はこの道具で自分の画面を書き換えた。
// 画面(page.tsx の 1 行スイッチが指す _screen/・_components/ の Screen)を画面の作り手 createScreen(@/wiring/screen)の形へ、
// page.tsx の題名の再 export を generateMetadata へ書き換える。リポのルートで走らせる。何度走らせても同じ結果になる。
//
//   node .notices/20261125-174936-cc-screen-maker.screen-maker.mjs            # dry-run(既定、書かない)。書き換える物と止まる一覧を出す
//   node .notices/20261125-174936-cc-screen-maker.screen-maker.mjs --apply    # 書く
//   --root=<dir>(既定 .)| --app=<dir>(既定 src/app、page.tsx を探す所。`_` で始まるフォルダ = 管理の雛形も見る)
//
// 書き換える形(TypeScript の構文木で読み、字面を差し替える):
//   export async function XScreen(props: T) {          export const { Screen: XScreen, generateMetadata } = createScreen({
//     [const <型> =] await loadXScreen(props);     →     load: loadXScreen,
//     [文…]                                              render: (<型> | ()) => …,   (文があれば { 文…; return …; }、await があれば async)
//     return …;                                          metadata: <export const metadata の値>,   (あれば)
//   }                                                  });
//   - load の後で props を読むなら render: (<型 | _data>, props) => …
//   - 使わなくなった import の名前(props の型・Metadata 等)を外し、`import { createScreen } from "@/wiring/screen"` を足す
//   - page.tsx: `export { X as default[, metadata] } from "./_screen|_components/X"` → `export { X as default, generateMetadata } …`
//     (Screen が作り手の形になった時だけ。既に作り手の形の Screen の page.tsx も揃える)
//
// 止まる一覧(書き換えず、ファイルと直し方 1 行): Screen を読めない・export の関数が無い・load の前の文・最初の文が
// `await load…(props)` でない・load の await が 2 回・型の注釈つきの束ね・自前の generateMetadata・page.tsx の自前の metadata /
// generateMetadata。直し方は createScreen の形(src/lib/screens/README.md「Screen の書き方」)
// fork の手順: 上流を取り込む(衝突は上流の版を採る)→ dry-run → --apply → 止まる一覧を手で createScreen の形へ →
// pnpm generate routes → 取り込みのコミット(型と画面の検査は /flux の区切りの検査が回す)
// exit 0(止まる物があっても)/ 2 = 引数の誤り

import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import ts from "typescript";

export const NOTICE_ID = "20261125-174936-cc-screen-maker";

export const MAKER_IMPORT = "@/wiring/screen";
const FORM = "export const { Screen: X, generateMetadata } = createScreen({ load: loadX, render: (data, props) => …, metadata? })";
const HINT = `手で ${FORM} に(src/lib/screens/README.md「Screen の書き方」)`;
const SWITCH = /export\s*\{([^}]*)\}\s*from\s*["']\.\/(_screen|_components)\/([\w./-]+?)["']\s*;?/;

/** src/app の下の page.tsx(node_modules・api を除く。`_` のフォルダ = 管理の雛形も含む) */
function findPages(appDir) {
  const out = [];
  const walk = (dir) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (entry.name === "node_modules") continue;
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (path.relative(appDir, full) === "api") continue;
        walk(full);
      } else if (entry.name === "page.tsx") out.push(full);
    }
  };
  if (existsSync(appDir)) walk(appDir);
  return out.sort();
}

function resolveScreen(pageFile, dir, file) {
  const base = path.join(path.dirname(pageFile), dir, file.replace(/\.tsx?$/, ""));
  return [`${base}.tsx`, `${base}/index.tsx`].find((f) => existsSync(f)) ?? null;
}

const isExported = (node) => !!node.modifiers?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword);

/** 最初の文の `[const <型> =] await load…(<props>)` */
function readLoadStatement(stmt, propsName) {
  let binding = null;
  let expr;
  if (ts.isExpressionStatement(stmt)) expr = stmt.expression;
  else if (ts.isVariableStatement(stmt) && stmt.declarationList.declarations.length === 1) {
    const decl = stmt.declarationList.declarations[0];
    if (decl.type) return { error: "load の結果の束ねに型の注釈がある(注釈を外して render の引数に)" };
    binding = decl.name;
    expr = decl.initializer;
  } else return null;
  if (!expr || !ts.isAwaitExpression(expr) || !ts.isCallExpression(expr.expression)) return null;
  const call = expr.expression;
  if (!ts.isIdentifier(call.expression) || !/^load[A-Z]\w*$/.test(call.expression.text)) return null;
  if (call.arguments.length !== 1 || !ts.isIdentifier(call.arguments[0]) || call.arguments[0].text !== propsName) return null;
  return { binding, loader: call.expression.text };
}

/** node の中の await(入れ子の関数の中は数えない) */
function hasAwait(node) {
  let found = false;
  const visit = (n) => {
    if (found) return;
    if (ts.isAwaitExpression(n)) {
      found = true;
      return;
    }
    if (ts.isFunctionLike(n)) return;
    ts.forEachChild(n, visit);
  };
  visit(node);
  return found;
}

/** 名前 name の識別子の参照があるか */
function usesIdentifier(nodes, name) {
  let found = false;
  const visit = (n) => {
    if (found) return;
    if (ts.isIdentifier(n) && n.text === name) {
      const parent = n.parent;
      // プロパティ名(a.name / { name: … } のキー)は参照でない
      if (parent && ts.isPropertyAccessExpression(parent) && parent.name === n) return;
      if (parent && ts.isPropertyAssignment(parent) && parent.name === n) return;
      found = true;
      return;
    }
    ts.forEachChild(n, visit);
  };
  for (const node of nodes) visit(node);
  return found;
}

/**
 * Screen のファイルを書き換える
 * @returns {{ status: "changed", text: string } | { status: "already" } | { status: "stop", reason: string }}
 */
export function transformScreen(source, name, fileName = "Screen.tsx") {
  const sf = ts.createSourceFile(fileName, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const stmts = sf.statements;
  const isMakerCall = (s) =>
    ts.isVariableStatement(s) &&
    s.declarationList.declarations.some((d) => d.initializer && ts.isCallExpression(d.initializer) && ts.isIdentifier(d.initializer.expression) && d.initializer.expression.text === "createScreen");
  if (stmts.some(isMakerCall)) return { status: "already" };

  const fn = stmts.find((s) => ts.isFunctionDeclaration(s) && s.name?.text === name && isExported(s));
  if (!fn || !fn.body) return { status: "stop", reason: `export の関数 ${name} が無い → ${HINT}` };
  if (stmts.some((s) => ts.isFunctionDeclaration(s) && s.name?.text === "generateMetadata") ||
    stmts.some((s) => ts.isVariableStatement(s) && s.declarationList.declarations.some((d) => ts.isIdentifier(d.name) && d.name.text === "generateMetadata"))) {
    return { status: "stop", reason: `自前の generateMetadata がある → createScreen の metadata: (data, props) => …(load の結果で作る)へ移して消す` };
  }
  if (fn.parameters.length > 1) return { status: "stop", reason: `${name} の引数が 2 つ以上 → ${HINT}` };
  const param = fn.parameters[0];
  if (param && !ts.isIdentifier(param.name)) return { status: "stop", reason: `${name} の引数が分割代入 → props で受けて load に渡す形に直してから(${HINT})` };
  const propsName = param ? param.name.text : null;
  const body = fn.body.statements;
  if (!propsName || body.length === 0) return { status: "stop", reason: `${name} が load(props) を呼ばない → ${HINT}` };
  const first = readLoadStatement(body[0], propsName);
  if (first?.error) return { status: "stop", reason: `${first.error} → ${HINT}` };
  if (!first) {
    const later = body.slice(1).some((s) => readLoadStatement(s, propsName));
    return { status: "stop", reason: later ? `load の前に文がある → 文を load の後(render の中)か loader へ移す(${HINT})` : `最初の文が await load…(${propsName}) でない(条件・try・JSX の中の load は不可)→ ${HINT}` };
  }
  const rest = body.slice(1);
  const loadAgain = rest.some((s) => {
    let hit = false;
    const visit = (n) => {
      if (hit) return;
      if (ts.isCallExpression(n) && ts.isIdentifier(n.expression) && n.expression.text === first.loader) hit = true;
      else ts.forEachChild(n, visit);
    };
    visit(s);
    return hit;
  });
  if (loadAgain) return { status: "stop", reason: `${first.loader} を 2 回呼ぶ → load は 1 回、結果を render で使う(${HINT})` };
  const last = rest[rest.length - 1];
  if (!last || !ts.isReturnStatement(last)) return { status: "stop", reason: `${name} の最後の文が return でない → ${HINT}` };

  // render の引数
  const usesProps = usesIdentifier(rest, propsName);
  const dataParam = first.binding ? first.binding.getText(sf) : usesProps ? "_data" : "";
  const params = usesProps ? `${dataParam}, ${propsName}` : dataParam;
  const isAsync = rest.some(hasAwait);
  let renderBody;
  if (rest.length === 1) {
    const expr = last.expression;
    if (!expr) return { status: "stop", reason: `${name} の return に値が無い → ${HINT}` };
    const text = expr.getText(sf);
    renderBody = ts.isObjectLiteralExpression(expr) ? `(${text})` : text;
  } else {
    // 関数の本体の文(字下げ 2)を render の塊(字下げ 4)へ。load の後の注釈も運ぶ
    const blockText = source.slice(rest[0].getFullStart(), last.getEnd()).replace(/^\s*\n/, "");
    renderBody = `{\n${blockText.split("\n").map((line) => (line === "" ? line : `  ${line}`)).join("\n")}\n  }`;
  }
  const renderLine = `  render: ${isAsync ? "async " : ""}(${params}) => ${renderBody},`;

  // metadata の値
  const metaStmt = stmts.find((s) => ts.isVariableStatement(s) && isExported(s) && s.declarationList.declarations.some((d) => ts.isIdentifier(d.name) && d.name.text === "metadata"));
  let metadataLine = "";
  if (metaStmt) {
    const decl = metaStmt.declarationList.declarations.find((d) => d.name.text === "metadata");
    if (!decl.initializer) return { status: "stop", reason: `export const metadata に値が無い → ${HINT}` };
    // 値の 2 行目から(最上位の字下げ 0)を設定の中の字下げ 2 へ
    const value = decl.initializer.getText(sf).split("\n").map((line, i) => (i === 0 || line === "" ? line : `  ${line}`)).join("\n");
    metadataLine = `\n  metadata: ${value},`;
  }

  const replacement = `export const { Screen: ${name}, generateMetadata } = createScreen({\n  load: ${first.loader},\n${renderLine}${metadataLine}\n});`;

  // 差し替え(後ろから)
  /** @type {{ start: number, end: number, text: string }[]} */
  const edits = [{ start: fn.getStart(sf), end: fn.getEnd(), text: replacement }];
  if (metaStmt) {
    let end = metaStmt.getEnd();
    while (source[end] === "\n" && source[end + 1] === "\n") end += 1;
    edits.push({ start: metaStmt.getStart(sf), end: end + (source[end] === "\n" ? 1 : 0), text: "" });
  }
  let text = source;
  for (const e of edits.sort((a, b) => b.start - a.start)) text = text.slice(0, e.start) + e.text + text.slice(e.end);
  text = pruneImports(source, text);
  text = addMakerImport(text);
  return { status: "changed", text };
}

/** 書き換えで使わなくなった import の名前を外す(前に使っていて、今は使わない名前だけ) */
function pruneImports(before, after) {
  const sf = ts.createSourceFile("x.tsx", after, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const beforeSf = ts.createSourceFile("x.tsx", before, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const bodyText = (file) => file.statements.filter((s) => !ts.isImportDeclaration(s)).map((s) => s.getText(file)).join("\n");
  const used = (text, n) => new RegExp(`(?<![\\w$.])${n.replace(/\$/g, "\\$")}(?![\\w$])`).test(text);
  const afterBody = bodyText(sf);
  const beforeBody = bodyText(beforeSf);
  const edits = [];
  for (const imp of sf.statements.filter(ts.isImportDeclaration)) {
    const clause = imp.importClause;
    if (!clause) continue;
    const names = [];
    if (clause.name) names.push({ local: clause.name.text, node: clause.name, kind: "default" });
    const bindings = clause.namedBindings;
    if (bindings && ts.isNamedImports(bindings)) for (const el of bindings.elements) names.push({ local: el.name.text, node: el, kind: "named" });
    const drop = names.filter((n) => used(beforeBody, n.local) && !used(afterBody, n.local));
    if (drop.length === 0) continue;
    if (drop.length === names.length || (bindings && ts.isNamespaceImport(bindings))) {
      if (bindings && ts.isNamespaceImport(bindings) && drop.length !== names.length) continue;
      let end = imp.getEnd();
      if (after[end] === "\n") end += 1;
      edits.push({ start: imp.getStart(sf), end, text: "" });
      continue;
    }
    const keep = names.filter((n) => !drop.includes(n));
    const def = keep.find((n) => n.kind === "default");
    const named = keep.filter((n) => n.kind === "named").map((n) => n.node.getText(sf));
    const typeOnly = clause.isTypeOnly ? "type " : "";
    const parts = [def?.local, named.length ? `{ ${named.join(", ")} }` : null].filter(Boolean).join(", ");
    edits.push({ start: imp.getStart(sf), end: imp.getEnd(), text: `import ${typeOnly}${parts} from ${imp.moduleSpecifier.getText(sf)};` });
  }
  let text = after;
  for (const e of edits.sort((a, b) => b.start - a.start)) text = text.slice(0, e.start) + e.text + text.slice(e.end);
  return text;
}

function addMakerImport(text) {
  if (new RegExp(`from\\s*["']${MAKER_IMPORT}["']`).test(text)) return text;
  const sf = ts.createSourceFile("x.tsx", text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const imports = sf.statements.filter(ts.isImportDeclaration);
  const line = `import { createScreen } from "${MAKER_IMPORT}";`;
  if (imports.length === 0) {
    const first = sf.statements[0];
    const at = first ? first.getStart(sf) : text.length;
    return `${text.slice(0, at)}${line}\n\n${text.slice(at)}`;
  }
  // 最後の相対でない import の後(無ければ最初の import の前)に置く
  const absolute = imports.filter((i) => !/^["']\./.test(i.moduleSpecifier.getText(sf)));
  if (absolute.length > 0) {
    const at = absolute[absolute.length - 1].getEnd();
    return `${text.slice(0, at)}\n${line}${text.slice(at)}`;
  }
  if (imports.length > 0) {
    const at = imports[0].getStart(sf);
    return `${text.slice(0, at)}${line}\n\n${text.slice(at)}`;
  }
  const lastImp = imports[imports.length - 1];
  return `${text.slice(0, lastImp.getEnd())}\n${line}${text.slice(lastImp.getEnd())}`;
}

/**
 * page.tsx を書き換える
 * @returns {{ status: "changed", text: string } | { status: "already" } | { status: "stop", reason: string } | { status: "skip" }}
 */
export function transformPage(source) {
  const m = SWITCH.exec(source);
  if (!m) return { status: "skip" };
  const code = source.replace(/\/\/.*$/gm, "").replace(/\/\*[\s\S]*?\*\//g, "");
  if (/export\s+(const|let)\s+metadata\b/.test(code) || /export\s+(async\s+)?function\s+generateMetadata\b|export\s+const\s+generateMetadata\b/.test(code)) {
    return { status: "stop", reason: "page.tsx に自前の metadata / generateMetadata がある → Screen の createScreen の metadata へ移し、page.tsx は Screen の generateMetadata を再 export" };
  }
  const specs = m[1].split(",").map((s) => s.trim()).filter(Boolean);
  const next = specs.filter((s) => s !== "metadata");
  if (!next.includes("generateMetadata")) {
    const at = next.findIndex((s) => /\sas\s+default$/.test(s));
    next.splice(at + 1, 0, "generateMetadata");
  }
  if (next.join(", ") === specs.join(", ")) return { status: "already" };
  const replaced = m[0].replace(m[1], ` ${next.join(", ")} `);
  return { status: "changed", text: source.replace(m[0], replaced) };
}

/** リポ全体の計画 */
export function plan(root, { app = "src/app" } = {}) {
  const appDir = path.join(root, app);
  const rel = (f) => path.relative(root, f);
  /** @type {{ file: string, text: string }[]} */
  const writes = [];
  /** @type {{ file: string, reason: string }[]} */
  const stops = [];
  let already = 0;
  for (const page of findPages(appDir)) {
    const source = readFileSync(page, "utf8");
    const m = SWITCH.exec(source);
    if (!m) continue;
    const name = (m[1].split(",").map((s) => s.trim()).find((s) => /\sas\s+default$/.test(s)) ?? "").replace(/\s+as\s+default$/, "");
    const screenFile = resolveScreen(page, m[2], m[3]);
    if (!name || !screenFile) {
      stops.push({ file: rel(page), reason: `1 行スイッチの Screen(./${m[2]}/${m[3]})を読めない → ${HINT}` });
      continue;
    }
    const screen = transformScreen(readFileSync(screenFile, "utf8"), name, screenFile);
    if (screen.status === "stop") {
      stops.push({ file: rel(screenFile), reason: screen.reason });
      continue;
    }
    if (screen.status === "changed") {
      if (!writes.some((w) => w.file === rel(screenFile))) writes.push({ file: rel(screenFile), text: screen.text });
    } else already += 1;
    const pageResult = transformPage(source);
    if (pageResult.status === "stop") stops.push({ file: rel(page), reason: pageResult.reason });
    else if (pageResult.status === "changed") writes.push({ file: rel(page), text: pageResult.text });
  }
  return { writes, stops, already };
}

function main(argv) {
  const args = { apply: false, root: ".", app: "src/app" };
  for (const a of argv) {
    if (a === "--apply") args.apply = true;
    else if (a.startsWith("--root=")) args.root = a.slice(7);
    else if (a.startsWith("--app=")) args.app = a.slice(6);
    else {
      console.error(`不明な引数: ${a}`);
      return 2;
    }
  }
  const root = path.resolve(args.root);
  const { writes, stops, already } = plan(root, { app: args.app });
  const screens = writes.filter((w) => !w.file.endsWith("/page.tsx")).length;
  const pages = writes.length - screens;
  console.log(`${args.apply ? "書いた" : "書き換える(dry-run)"}: Screen ${screens}・page.tsx ${pages} / 作り手の形のまま ${already} / 止まる ${stops.length}`);
  for (const w of writes) console.log(`  ${w.file}`);
  if (stops.length > 0) {
    console.log("止まる一覧(書き換えていない。手で直す):");
    for (const s of stops) console.log(`  - ${s.file}: ${s.reason}`);
  }
  if (args.apply) for (const w of writes) writeFileSync(path.join(root, w.file), w.text);
  return 0;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  process.exitCode = main(process.argv.slice(2));
}
