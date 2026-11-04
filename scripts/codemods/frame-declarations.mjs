#!/usr/bin/env node
// scripts/codemods/frame-declarations.mjs
// 枠の部位の出し入れを枠の宣言 frame.ts へ移す(共有の棚の枠の宣言の移行、D62・D65・D66・D90・D165・D170)。fork のリポのルートで走らせる。
// 使い方: node scripts/codemods/frame-declarations.mjs [--apply] [--base <rev>] [--json]
//   既定は dry-run(変更の一覧と止める一覧を出すだけ)。--apply で frame.ts を書き、タグ・属性・import を消す。
//   最後に生成器の検査(scripts/extensions/frames.mjs の planFrames)を書いた結果に掛けて出す。手順: ./README.md「枠の宣言へ移す」
//
// 触るのは fork が足したファイルだけ(基準 = 台帳の最後の upstream:<sha> の版に無いファイル)。上流のファイルは取り込みで移る。
// - 自己閉じの Hide*(HideHeader・HideHeaderNav・HideFooter・HideBottomNav、sp / pc 指定つき)→ 隣の frame.ts
//   (page.tsx の中 → page:、layout.tsx の中 → layout:、<ルート>/_screen・_components の中の <名前>Screen.tsx → そのルートの page:。ほかの部品は止める)
// - <UserPage fill> / <AdminPage fill> → そのルートの frame.ts の page: { fill: true }、属性を消す
// - 枠の設定の 4 つ(BOTTOM_NAV_ENABLED・BOTTOM_NAV_VISIBILITY・HEADER_ENABLED・HEADER_NAV_ENABLED)の値が上流の旧い既定と違う
//   → src/app/(user)/frame.ts の layout:(設定の行は書き換えない。上流はもう読まないので消してよい)
// 止める(書き換えず手で直す): 子を持つ・条件つき・式の props の Hide*、ルートの外の Hide* と fill、immersive、
// 消えた API の読み手(useBottomNavItems().enabled・useHeaderData().enabled / navEnabled・設定の 4 つの import)、読めない frame.ts。
// 書くのはいつも frame.ts(上流のルートの隣でも自分のルートでも。frame.default.ts は書かない)。

import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import ts from "typescript";

import { FRAME_ROOTS, hideableParts } from "../../src/app/_layout/frame/parts.mjs";
import { checkFrameDeclaration } from "../../src/app/_layout/frame/resolve.mjs";
import { headerFor } from "../extensions/extensions.mjs";
import { FRAME_FILE, planFrames, readExportedLiteral } from "../extensions/frames.mjs";
import { readBaseFiles } from "./fork-name-markers.mjs";

const SKIP_DIRS = new Set(["node_modules", ".next", ".git", ".turbo", "dist", "coverage"]);
const HIDE_MODULE = /AppFrames\/User\/controls/;
/** 旧い Hide* の部品 → 宣言のキー(利用者の枠の隠せる部位) */
const HIDE_TAGS = { HideHeader: "header", HideHeaderNav: "headerNav", HideFooter: "footer", HideBottomNav: "bottomNav" };
const PAGE_TAGS = [
  { module: /(?:^|\/)\(user\)\/_layout\/UserPage$/, root: "user" },
  { module: /(?:^|\/)admin\/_layout\/AdminPage$/, root: "admin" },
];
const DEVICES = ["sp", "pc"];
const CONFIG_BOTTOM = "src/config/ui/user-bottom-menu.config.ts";
const CONFIG_HEADER = "src/config/ui/user-header.config.ts";
const REMOVED_CONSTS = ["BOTTOM_NAV_ENABLED", "BOTTOM_NAV_VISIBILITY", "HEADER_ENABLED", "HEADER_NAV_ENABLED"];
const PAGE_FILE = /^page\.(tsx|ts|jsx|js)$/;
const LAYOUT_FILE = /^layout\.(tsx|ts|jsx|js)$/;

/** src の下のファイル(リポジトリ直下からの相対) */
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
  return out.sort();
}

const dirOf = (path) => path.slice(0, path.lastIndexOf("/"));
const rootOf = (dir) => Object.keys(FRAME_ROOTS).find((r) => dir === FRAME_ROOTS[r].dir || dir.startsWith(`${FRAME_ROOTS[r].dir}/`)) ?? null;
const hasFile = (root, dir, re) => existsSync(join(root, dir)) && readdirSync(join(root, dir)).some((name) => re.test(name));

/**
 * タグのあるファイルから宣言の置き場を決める。{ dir, scope, root } か { problem }
 * page.tsx → page: / layout.tsx → layout: / <ルート>/_screen・_components の下 → そのルートの page:
 */
export function placementOf(root, path) {
  const name = path.slice(path.lastIndexOf("/") + 1);
  let dir;
  let scope;
  if (PAGE_FILE.test(name)) [dir, scope] = [dirOf(path), "page"];
  else if (LAYOUT_FILE.test(name)) [dir, scope] = [dirOf(path), "layout"];
  else {
    const match = /^(src\/app\/.*?)\/(?:_screen|_components)\/(?:.*\/)?[A-Za-z0-9]*Screen\.tsx$/.exec(path);
    if (!match) {
      return /\/(?:_screen|_components)\//.test(path)
        ? { problem: "Screen(<名前>Screen.tsx)でない部品。使う page / layout が決まらない(使う側の frame.ts に手で書く)" }
        : { problem: "ルートの page / layout / Screen(_screen・_components)の外。宣言の置き場が決まらない(使うページの frame.ts に手で書く)" };
    }
    [dir, scope] = [match[1], "page"];
    if (!hasFile(root, dir, PAGE_FILE)) return { problem: `${dir} に page.tsx が無い(Screen を使うページの frame.ts に手で書く)` };
  }
  const frameRoot = rootOf(dir);
  if (frameRoot === null) return { problem: `枠の layout の外(${Object.values(FRAME_ROOTS).map((r) => r.dir).join(" / ")} の下だけ)` };
  if (dir.split("/").some((seg) => seg.startsWith("_") || seg.startsWith("@") || /^\(\.{1,3}\)/.test(seg))) return { problem: "private フォルダ・@slot・intercepting の下には宣言を置けない" };
  return { dir, scope, root: frameRoot };
}

/** JSX の属性 → { name, value: true | false | null(式), node } */
function attributesOf(opening) {
  return opening.attributes.properties.map((a) => {
    if (!ts.isJsxAttribute(a)) return { name: "...", value: null, node: a };
    const name = a.name.getText();
    if (!a.initializer) return { name, value: true, node: a };
    const kind = ts.isJsxExpression(a.initializer) ? a.initializer.expression?.kind : undefined;
    return { name, value: kind === ts.SyntaxKind.TrueKeyword ? true : kind === ts.SyntaxKind.FalseKeyword ? false : null, node: a };
  });
}

/** タグが条件の中か(JSX の子として直接置かれていない) */
const isConditional = (node) => !(ts.isJsxElement(node.parent) || ts.isJsxFragment(node.parent) || ts.isParenthesizedExpression(node.parent) || ts.isReturnStatement(node.parent) || ts.isArrowFunction(node.parent));

/** 削る範囲(行にタグだけなら行ごと) */
function lineRange(text, start, end) {
  const lineStart = text.lastIndexOf("\n", start - 1) + 1;
  const nl = text.indexOf("\n", end);
  const lineEnd = nl === -1 ? text.length : nl + 1;
  if (text.slice(lineStart, start).trim() === "" && text.slice(end, lineEnd).trim() === "") return [lineStart, lineEnd];
  return [start, end];
}

/** 置き場 → 宣言への足し込み */
function addTo(decls, frameFile, scope, value) {
  const decl = decls.get(frameFile) ?? { layout: undefined, page: undefined };
  const section = decl[scope] ?? {};
  for (const [key, setting] of Object.entries(value.hide ?? {})) section.hide = { ...section.hide, [key]: { ...section.hide?.[key], ...setting } };
  if (value.fill !== undefined) section.fill = value.fill;
  decl[scope] = section;
  decls.set(frameFile, decl);
}

/** 1 つのファイルを見る */
function scanFile(root, path, text, { decls, changes, stops, edits }) {
  const source = ts.createSourceFile(path, text, ts.ScriptTarget.Latest, true, path.endsWith("x") ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  const hideNames = new Map();
  const pageNames = new Map();
  for (const statement of source.statements) {
    if (!ts.isImportDeclaration(statement) || !ts.isStringLiteral(statement.moduleSpecifier)) continue;
    const from = statement.moduleSpecifier.text;
    const clause = statement.importClause;
    const named = clause?.namedBindings && ts.isNamedImports(clause.namedBindings) ? clause.namedBindings.elements : [];
    if (HIDE_MODULE.test(from)) for (const el of named) if ((el.propertyName ?? el.name).text in HIDE_TAGS) hideNames.set(el.name.text, HIDE_TAGS[(el.propertyName ?? el.name).text]);
    const page = PAGE_TAGS.find((p) => p.module.test(from));
    if (page) {
      if (clause?.name) pageNames.set(clause.name.text, page.root);
      for (const el of named) pageNames.set(el.name.text, page.root);
    }
    for (const el of named) {
      const name = (el.propertyName ?? el.name).text;
      if (REMOVED_CONSTS.includes(name)) stops.push({ path, reason: `消えた設定 ${name} を読んでいる(枠の出し入れは frame.ts の宣言。読み手を手で直す)` });
    }
  }
  if (/\buseBottomNavItems\s*\(/.test(text) && /\benabled\b/.test(text)) stops.push({ path, reason: "useBottomNavItems().enabled を読んでいる(消えた値。ボトムナビの出し入れは frame.ts の宣言、手で直す)" });
  if (/\buseHeaderData\s*\(/.test(text) && /\b(enabled|navEnabled)\b/.test(text)) stops.push({ path, reason: "useHeaderData().enabled / navEnabled を読んでいる(消えた値。ヘッダーの出し入れは frame.ts の宣言、手で直す)" });
  if (hideNames.size === 0 && pageNames.size === 0) return;

  const ranges = [];
  const visit = (node) => {
    const opening = ts.isJsxSelfClosingElement(node) ? node : ts.isJsxElement(node) ? node.openingElement : null;
    const tag = opening?.tagName.getText();
    if (opening && hideNames.has(tag)) {
      const at = `${path}:${source.getLineAndCharacterOfPosition(node.getStart()).line + 1}`;
      const attrs = attributesOf(opening);
      const place = placementOf(root, path);
      if (ts.isJsxElement(node)) stops.push({ path: at, reason: `<${tag}> が子を持つ(手で直す)` });
      else if (isConditional(node)) stops.push({ path: at, reason: `<${tag}> が条件の中(ページごとに決まらない。手で直す)` });
      else if (attrs.some((a) => !DEVICES.includes(a.name) || a.value === null)) stops.push({ path: at, reason: `<${tag}> の props が sp / pc の真偽でない(手で直す)` });
      else if (place.problem) stops.push({ path: at, reason: `<${tag}>: ${place.problem}` });
      else if (place.root !== "user") stops.push({ path: at, reason: `<${tag}> は利用者の枠の部品(管理の枠の下。手で直す)` });
      else {
        const given = attrs.length === 0 ? { sp: true, pc: true } : Object.fromEntries(attrs.filter((a) => a.value === true).map((a) => [a.name, true]));
        const frameFile = `${place.dir}/${FRAME_FILE}`;
        if (Object.keys(given).length > 0) addTo(decls, frameFile, place.scope, { hide: { [hideNames.get(tag)]: given } });
        changes.push({ path: at, kind: "hide", to: frameFile, scope: place.scope, part: hideNames.get(tag), devices: Object.keys(given) });
        ranges.push(lineRange(text, node.getStart(), node.getEnd()));
      }
    } else if (opening && pageNames.has(tag)) {
      const at = `${path}:${source.getLineAndCharacterOfPosition(node.getStart()).line + 1}`;
      const attrs = attributesOf(opening);
      const immersive = attrs.find((a) => a.name === "immersive");
      const fill = attrs.find((a) => a.name === "fill");
      if (immersive) stops.push({ path: at, reason: `<${tag} immersive> は意味が 1 つに決まらない(page: の fill と隠す部位を frame.ts に手で書き、safeArea などの見た目は部品に移す)` });
      else if (fill) {
        const place = placementOf(root, path);
        if (fill.value === null) stops.push({ path: at, reason: `<${tag} fill={…}> が式(ページごとに決まらない。手で直す)` });
        else if (place.problem) stops.push({ path: at, reason: `<${tag} fill>: ${place.problem}` });
        else if (place.root !== pageNames.get(tag)) stops.push({ path: at, reason: `<${tag}> が別の枠の下にある(手で直す)` });
        else {
          const frameFile = `${place.dir}/${FRAME_FILE}`;
          if (fill.value) addTo(decls, frameFile, "page", { fill: true });
          changes.push({ path: at, kind: "fill", to: frameFile, scope: "page", value: fill.value });
          ranges.push([fill.node.getFullStart(), fill.node.getEnd()]);
        }
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  if (ranges.length > 0) edits.set(path, ranges);
}

/** 設定の 4 つの値 → (user)/frame.ts の layout:(上流の旧い既定との差だけ) */
function scanConfig(root, { decls, changes }) {
  const read = (path, name) => (existsSync(join(root, path)) ? readExportedLiteral(path, readFileSync(join(root, path), "utf8"), name) : { problem: "無い" });
  const hide = {};
  const enabled = read(CONFIG_BOTTOM, "BOTTOM_NAV_ENABLED");
  const visibility = read(CONFIG_BOTTOM, "BOTTOM_NAV_VISIBILITY");
  const header = read(CONFIG_HEADER, "HEADER_ENABLED");
  const nav = read(CONFIG_HEADER, "HEADER_NAV_ENABLED");
  const noted = [];
  if (enabled.value === false) {
    hide.bottomNav = { sp: true, pc: true };
    noted.push("BOTTOM_NAV_ENABLED = false");
  } else if (visibility.value && typeof visibility.value === "object") {
    const setting = {};
    if (visibility.value.sp === false) setting.sp = true;
    if (visibility.value.pc === true) setting.pc = false;
    if (Object.keys(setting).length > 0) {
      hide.bottomNav = setting;
      noted.push(`BOTTOM_NAV_VISIBILITY = ${JSON.stringify(visibility.value)}`);
    }
  }
  if (header.value === false) {
    hide.header = { sp: true, pc: true };
    noted.push("HEADER_ENABLED = false");
  }
  if (nav.value && typeof nav.value === "object") {
    const setting = Object.fromEntries(DEVICES.filter((d) => nav.value[d] === false).map((d) => [d, true]));
    if (Object.keys(setting).length > 0) {
      hide.headerNav = setting;
      noted.push(`HEADER_NAV_ENABLED = ${JSON.stringify(nav.value)}`);
    }
  }
  if (Object.keys(hide).length === 0) return;
  const frameFile = `${FRAME_ROOTS.user.dir}/${FRAME_FILE}`;
  addTo(decls, frameFile, "layout", { hide });
  changes.push({ path: `${CONFIG_BOTTOM} / ${CONFIG_HEADER}`, kind: "config", to: frameFile, scope: "layout", values: noted, note: "設定の行は上流がもう読まないので消してよい(道具は書き換えない)" });
}

/** frame.ts の中身 */
export function renderFrame(root, decl) {
  const type = root === "admin" ? "AdminFrameDeclaration" : "FrameDeclaration";
  const lines = [
    "// 枠の宣言(上流の既定 frame.default.ts の上に重なる)。書式: src/app/_layout/frame/README.md",
    `import type { ${type} } from "@/app/_layout/frame";`,
    "",
    "export const frame = {",
  ];
  const keys = hideableParts(root).map((p) => p.key);
  for (const scope of ["layout", "page"]) {
    const section = decl[scope];
    if (!section) continue;
    const parts = [];
    if (section.hide) {
      const hides = keys.filter((k) => section.hide[k]).map((k) => `${k}: { ${DEVICES.filter((d) => section.hide[k][d] !== undefined).map((d) => `${d}: ${section.hide[k][d]}`).join(", ")} }`);
      if (hides.length > 0) parts.push(`hide: { ${hides.join(", ")} }`);
    }
    if (section.fill !== undefined) parts.push(`fill: ${section.fill}`);
    lines.push(`  ${scope}: { ${parts.join(", ")} },`);
  }
  lines.push(`} satisfies ${type};`, "");
  return lines.join("\n");
}

/**
 * 移行の計画
 * @param {string} root fork のリポのルート
 * @param {{ baseFiles: string[] }} options 基準の版のファイル(上流の物。触らない)
 */
export function planFrameMigration(root, { baseFiles }) {
  const base = new Set(baseFiles);
  const decls = new Map();
  const changes = [];
  const stops = [];
  const edits = new Map();
  for (const path of listFiles(root)) {
    if (base.has(path) || !/\.(tsx|ts)$/.test(path) || /\.(test|spec|d)\.tsx?$/.test(path)) continue;
    scanFile(root, path, readFileSync(join(root, path), "utf8"), { decls, changes, stops, edits });
  }
  scanConfig(root, { decls, changes });
  // 既にある frame.ts に足す(読めなければ止める)
  const writes = [];
  for (const [frameFile, decl] of [...decls.entries()].sort(([a], [b]) => (a < b ? -1 : 1))) {
    const frameRoot = rootOf(dirOf(frameFile));
    let merged = { layout: undefined, page: undefined };
    if (existsSync(join(root, frameFile))) {
      const read = readExportedLiteral(frameFile, readFileSync(join(root, frameFile), "utf8"), "frame");
      const problems = read.problem ? [read.problem] : checkFrameDeclaration(read.value, frameRoot);
      if (problems.length > 0) {
        stops.push({ path: frameFile, reason: `今の frame.ts を読めない(${problems.join(" / ")})。足す分: ${JSON.stringify(decl)}` });
        for (const c of changes.filter((c) => c.to === frameFile)) c.blocked = true;
        continue;
      }
      merged = { ...read.value };
    }
    const into = new Map([[frameFile, merged]]);
    for (const scope of ["layout", "page"]) if (decl[scope]) addTo(into, frameFile, scope, decl[scope]);
    writes.push({ path: frameFile, root: frameRoot, existed: existsSync(join(root, frameFile)), text: renderFrame(frameRoot, into.get(frameFile)) });
  }
  return { changes, stops, writes, edits: [...edits.entries()].map(([path, ranges]) => ({ path, ranges })).filter((e) => !changes.some((c) => c.blocked && c.path.startsWith(`${e.path}:`))) };
}

/** タグ・属性を消し、使われなくなった import を消す */
export function applyEdits(text, ranges) {
  let out = text;
  for (const [start, end] of [...ranges].sort((a, b) => b[0] - a[0])) out = out.slice(0, start) + out.slice(end);
  const source = ts.createSourceFile("x.tsx", out, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const importEdits = [];
  for (const statement of source.statements) {
    if (!ts.isImportDeclaration(statement) || !ts.isStringLiteral(statement.moduleSpecifier) || !HIDE_MODULE.test(statement.moduleSpecifier.text)) continue;
    const named = statement.importClause?.namedBindings;
    if (!named || !ts.isNamedImports(named)) continue;
    const rest = out.slice(0, statement.getFullStart()) + out.slice(statement.getEnd());
    const kept = named.elements.filter((el) => new RegExp(`\\b${el.name.text}\\b`).test(rest));
    if (kept.length === named.elements.length) continue;
    const replacement = kept.length === 0 ? null : `import { ${kept.map((el) => el.getText()).join(", ")} } from ${statement.moduleSpecifier.getText()};`;
    importEdits.push({ start: statement.getStart(), end: statement.getEnd(), replacement });
  }
  for (const e of importEdits.sort((a, b) => b.start - a.start)) {
    if (e.replacement !== null) out = out.slice(0, e.start) + e.replacement + out.slice(e.end);
    else {
      const [s, t] = lineRange(out, e.start, e.end);
      out = out.slice(0, s) + out.slice(t);
    }
  }
  return out;
}

/** 計画を書き出す */
export function applyFrameMigration(root, plan) {
  for (const w of plan.writes) writeFileSync(join(root, w.path), w.text);
  for (const e of plan.edits) writeFileSync(join(root, e.path), applyEdits(readFileSync(join(root, e.path), "utf8"), e.ranges));
  return { written: plan.writes.map((w) => w.path), edited: plan.edits.map((e) => e.path) };
}

/** 書いた結果に生成器の検査を掛ける(fork として) */
export const checkFrames = (root) => planFrames(root, headerFor, { isTier1: false });

function main() {
  const args = process.argv.slice(2);
  const root = process.cwd();
  const apply = args.includes("--apply");
  const json = args.includes("--json");
  const baseIndex = args.indexOf("--base");
  const base = readBaseFiles(root, baseIndex >= 0 ? args[baseIndex + 1] : null);
  if (base.problem) {
    console.error(`[frame-declarations] ${base.problem}`);
    process.exit(2);
  }
  const plan = planFrameMigration(root, { baseFiles: base.files });
  const result = { base: base.rev, mode: apply ? "apply" : "dry-run", changes: plan.changes, stops: plan.stops, writes: plan.writes.map((w) => ({ path: w.path, existed: w.existed })) };
  if (apply) {
    Object.assign(result, applyFrameMigration(root, plan));
    result.check = checkFrames(root).problems;
  }
  if (json) {
    console.log(JSON.stringify(result, null, 2));
  } else {
    console.log(`[frame-declarations] ${result.mode}(基準 ${String(base.rev).slice(0, 10)})`);
    console.log(`変更: ${plan.changes.length} 件`);
    for (const c of plan.changes) console.log(`  ${c.path} → ${c.to} ${c.scope}: ${c.kind === "hide" ? `hide.${c.part} ${c.devices.join("/") || "(false だけ、消すだけ)"}` : c.kind === "fill" ? `fill ${c.value}` : c.values.join(", ")}${c.note ? `(${c.note})` : ""}${c.blocked ? " [止めた frame.ts のため保留]" : ""}`);
    console.log(`frame.ts: ${plan.writes.map((w) => `${w.path}${w.existed ? "(足す)" : "(新規)"}`).join(", ") || "なし"}`);
    console.log(`止めた物(書き換えない): ${plan.stops.length} 件`);
    for (const s of plan.stops) console.log(`  ${s.path}: ${s.reason}`);
    if (apply) {
      console.log(`書き換えたファイル: ${result.edited.length}`);
      console.log(result.check.length === 0 ? "生成器の検査: 問題なし(続けて pnpm extensions:generate)" : `生成器の検査の問題 ${result.check.length} 件:\n${result.check.map((p) => `  - ${p}`).join("\n")}`);
    }
  }
  if (apply && result.check.length > 0) process.exit(1);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main();
