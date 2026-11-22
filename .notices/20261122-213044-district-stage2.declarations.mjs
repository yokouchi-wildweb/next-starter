#!/usr/bin/env node
// .notices/20261122-213044-district-stage2.declarations.mjs
// 拡張点の宣言(extensionPoints.ts)の各点に変え方の型 change を書き足す(地区の議会 段 2、D35: 宣言 2 段の 1 段目)。上流(Tier1)も fork も同じ道具で、リポのルートで走らせる。
// (区切り district-stage2 の notice .notices/20261122-213044-district-stage2.md の道具)
// 使い方: node .notices/20261122-213044-district-stage2.declarations.mjs [--apply] [--json] [--side <既定のパス>=<client|server|shared> …] [--owner <既定のパス>=<宣言のパス> …]
//   既定は dry-run(書き足す点と止める点を出すだけ、何も書かない)。--apply で書く。何度走らせても同じ結果(change のある点・宣言済みの差替点は触らない)
//
// 仕事は 2 つ:
// 1. change の書き足し(下の決まり)
// 2. 差替点の宣言(注文 16): 1 行スイッチの既定 <名前>.default.ts(x) で、どの宣言の差替点(default)にも無い物に
//    { change: "replace", default, type, side } の点を持ち主の地区の extensionPoints.ts へ足す(無ければ作る)。
//    持ち主 = 地区の地図の見つけ方(src/lib/districtMap readDistrictMapAt)で、既定を中に持つ一番深い地区。点の名前 = スイッチの名前の先頭を小文字。
//    type = 既定が export する <名前>Props → ただ 1 つの export type → export const <x>: <T> の T(import type の元)。決まらなければ候補つきで止める。
//    side = "use client" の既定は client、パスに /server/ があれば server。どちらでもなければ止め、人が --side で決める(持ち主の無い物は --owner)
//    止める物: 持ち主の地区が無い(src/app の下なら候補 = 一番近い枠の地区)・型が決まらない・側が決まらない・点の名前が宣言に既にある
// 3. 門番の規則の書き直し(注文 20、D23・D28): src/featureGate/rules/<名前>.ts が値を import していれば、
//    `import { <名前> } from "@/domains/[core/]<d>/config"` + `enabled: () => <名前>`(<名前> が config.ts の最上位の真偽の export)の形だけ
//    when: ["<d>.<名前>"] に書き直して import を外す。ほか(入れ子・式・住所の組み立て・ほかの import・when が既にある)は候補つきで止める
//
// 書き足す change(読み手 src/lib/districtMap/declarations.mjs の changeOfFields と同じ決まり):
// - placement の点 → counterpart(対置点)/ overrides の点 → override(上書点)/ default の点 → replace(差替点)
// - dir・files の受け口と writer の一覧 → add(増設点)
// 書き方: 点の object の { の直後に change: "<型>" を足す(1 行の点は `{ change: "add", dir: …`、複数行の点は最初の欄と同じ字下げの行)
//
// 対象: git の木なら git ls-files -co --exclude-standard の src/**/extensionPoints.ts(生成一覧 extensions/ と node_modules の下は除く)。
//   fork では上流の宣言は取り込みで書き足し済み(change がある)なので、書くのは fork が足した宣言だけ
// 止める物(書かず、候補つきで出す): 宣言が読めない(export const extensionPoints = { … } が無い・リテラルでない)/ 点が object でない
//
// fork の手順: 上流の段 2 の区間を取り込む → dry-run → 止めた物を片付ける → --apply → pnpm generate extensions・district-map

import { execFileSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import ts from "typescript";

import { DEFAULT_FILE, changeOfFields, isClaimedDefault, isDeclarationPath, literalOf } from "../src/lib/districtMap/index.mjs";
import { readDistrictMapAt } from "../src/lib/districtMap/node.mjs";
import { booleanExportsOf, readRuleImports } from "../scripts/structure/extensions/derive/gateWhen.mjs";

const SKIP_DIRS = new Set(["node_modules", ".next", ".git", ".turbo", "dist", "coverage", ".vercel"]);

/** src の下のファイル(root 相対、posix。git の木なら追跡と未追跡の除外でない物) */
function listSrcFiles(root) {
  let files;
  if (existsSync(join(root, ".git"))) {
    files = execFileSync("git", ["ls-files", "-z", "-co", "--exclude-standard", "--", "src"], { cwd: root, encoding: "utf8", maxBuffer: 256 * 1024 * 1024 })
      .split("\0")
      .filter(Boolean);
  } else {
    files = [];
    const walk = (rel) => {
      for (const entry of readdirSync(join(root, rel), { withFileTypes: true })) {
        if (SKIP_DIRS.has(entry.name)) continue;
        const child = `${rel}/${entry.name}`;
        if (entry.isDirectory()) walk(child);
        else if (entry.isFile()) files.push(child);
      }
    };
    if (existsSync(join(root, "src"))) walk("src");
  }
  return [...new Set(files)].filter((p) => existsSync(join(root, p)) && statSync(join(root, p)).isFile()).sort();
}

/** 宣言のファイル(root 相対、posix) */
export const listDeclarations = (root) => listSrcFiles(root).filter(isDeclarationPath);

/**
 * 1 つの宣言の書き足し(純関数)
 * @param {string} path
 * @param {string} text
 * @returns {{ text: string, added: { point: string, change: string }[], stops: { point: string | null, text: string }[] }}
 */
export function addChanges(path, text) {
  const source = ts.createSourceFile(path, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  let initializer = null;
  for (const statement of source.statements) {
    if (!ts.isVariableStatement(statement) || !statement.modifiers?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword)) continue;
    for (const d of statement.declarationList.declarations) if (ts.isIdentifier(d.name) && d.name.text === "extensionPoints") initializer = d.initializer ?? null;
  }
  while (initializer && (ts.isAsExpression(initializer) || ts.isSatisfiesExpression(initializer) || ts.isParenthesizedExpression(initializer))) initializer = initializer.expression;
  if (!initializer || !ts.isObjectLiteralExpression(initializer)) return { text, added: [], stops: [{ point: null, text: "export const extensionPoints = { … } が無い(object のリテラルで書く)" }] };
  const inserts = [];
  const added = [];
  const stops = [];
  for (const property of initializer.properties) {
    const name = property.name && (ts.isIdentifier(property.name) || ts.isStringLiteral(property.name)) ? property.name.text : property.getText(source);
    if (!ts.isPropertyAssignment(property) || !ts.isObjectLiteralExpression(property.initializer)) {
      stops.push({ point: name, text: "点が object のリテラルでない" });
      continue;
    }
    const object = property.initializer;
    if (object.properties.some((p) => p.name && ts.isIdentifier(p.name) && p.name.text === "change")) continue;
    const read = literalOf(object);
    if (read.problem !== undefined) {
      stops.push({ point: name, text: read.problem });
      continue;
    }
    const change = changeOfFields(/** @type {Record<string, unknown>} */ (read.value));
    const open = object.getStart(source) + 1;
    const first = object.properties[0];
    let insert;
    if (!first) insert = ` change: "${change}" `;
    else {
      const firstLine = source.getLineAndCharacterOfPosition(first.getStart(source)).line;
      const openLine = source.getLineAndCharacterOfPosition(object.getStart(source)).line;
      if (firstLine === openLine) insert = ` change: "${change}",`;
      else {
        const lineStart = source.getPositionOfLineAndCharacter(firstLine, 0);
        const indent = text.slice(lineStart, first.getStart(source));
        insert = `\n${indent}change: "${change}",`;
      }
    }
    inserts.push({ at: open, insert });
    added.push({ point: name, change });
  }
  let out = text;
  for (const { at, insert } of inserts.sort((a, b) => b.at - a.at)) out = out.slice(0, at) + insert + out.slice(at);
  return { text: out, added, stops };
}

/** 宣言の object リテラル(export const extensionPoints = { … })。無ければ null */
function declarationObject(source) {
  let initializer = null;
  for (const statement of source.statements) {
    if (!ts.isVariableStatement(statement) || !statement.modifiers?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword)) continue;
    for (const d of statement.declarationList.declarations) if (ts.isIdentifier(d.name) && d.name.text === "extensionPoints") initializer = d.initializer ?? null;
  }
  while (initializer && (ts.isAsExpression(initializer) || ts.isSatisfiesExpression(initializer) || ts.isParenthesizedExpression(initializer))) initializer = initializer.expression;
  return initializer && ts.isObjectLiteralExpression(initializer) ? initializer : null;
}

/** 宣言の点の名前と、差替点の default(読めた物だけ。読めない宣言は change の書き足しが止める) */
export function declaredNames(path, text) {
  const object = declarationObject(ts.createSourceFile(path, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS));
  const names = [];
  const defaults = [];
  for (const property of object?.properties ?? []) {
    if (!ts.isPropertyAssignment(property) || !property.name || !(ts.isIdentifier(property.name) || ts.isStringLiteral(property.name))) continue;
    names.push(property.name.text);
    if (!ts.isObjectLiteralExpression(property.initializer)) continue;
    const read = literalOf(property.initializer);
    if (read.problem === undefined && typeof read.value === "object" && read.value !== null && !Array.isArray(read.value) && typeof read.value.default === "string") defaults.push(read.value.default);
  }
  return { names, defaults };
}

/** 差替点の 1 点の字(字下げ indent の点、末尾に , ) */
export function renderReplacePoint(name, spec, indent = "  ") {
  const inner = `${indent}  `;
  return [
    `${indent}// 差替点: 1 行スイッチ ${spec.default.slice(spec.default.lastIndexOf("/") + 1).replace(/\.default\.tsx?$/, "")}(fork は隣に <名前>.replace を作りスイッチを向け替える)`,
    `${indent}${name}: {`,
    `${inner}change: "replace",`,
    `${inner}default: ${JSON.stringify(spec.default)},`,
    `${inner}type: { from: ${JSON.stringify(spec.type.from)}, name: ${JSON.stringify(spec.type.name)} },`,
    `${inner}side: ${JSON.stringify(spec.side)},`,
    `${indent}},`,
  ].join("\n");
}

/**
 * 宣言のテキストに点を足す(object の最後の点の後ろ)。宣言が読めなければ problem
 * @returns {{ text: string } | { problem: string }}
 */
export function addPoint(path, text, name, spec) {
  const source = ts.createSourceFile(path, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const object = declarationObject(source);
  if (!object) return { problem: "export const extensionPoints = { … } が無い(object のリテラルで書く)" };
  const last = object.properties[object.properties.length - 1];
  if (!last) {
    const close = object.getEnd() - 1;
    return { text: `${text.slice(0, object.getStart(source) + 1)}\n${renderReplacePoint(name, spec)}\n${text.slice(close)}` };
  }
  const first = object.properties[0];
  const lineStart = source.getPositionOfLineAndCharacter(source.getLineAndCharacterOfPosition(first.getStart(source)).line, 0);
  const indent = /^\s*/.exec(text.slice(lineStart, first.getStart(source)))[0] || "  ";
  let at = last.getEnd();
  let head = text.slice(0, at);
  const rest = text.slice(at);
  const comma = /^\s*,/.exec(rest);
  if (comma) {
    at += comma[0].length;
    head = text.slice(0, at);
  } else head += ",";
  return { text: `${head}\n${renderReplacePoint(name, spec, indent)}${text.slice(at)}` };
}

/** 新しい宣言のファイルの本文 */
export const newDeclaration = (path, name, spec) =>
  `// ${path}\n// ${path.slice(0, path.lastIndexOf("/"))} の拡張点の宣言(リテラルだけ。読み手 = src/lib/districtMap/declarations.mjs)。書式: scripts/structure/extensions/README.md\n\nexport const extensionPoints = {\n${renderReplacePoint(name, spec)}\n};\n`;

/** 既定のファイルの @/ の import 元 */
const aliasOf = (path) => `@/${path.slice("src/".length).replace(/\.tsx?$/, "")}`;

/**
 * 1 つの既定から差替点の宣言を決める(純関数)。決まらなければ stop(候補つき)
 * @param {string} path 既定 <名前>.default.ts(x)
 * @param {string} text 既定の本文
 * @param {{ name: string, kind: string, dir: string }[]} districts 地区の地図の地区
 * @param {{ side?: string, owner?: string }} [given] 人が決めた側・宣言のファイル(--side・--owner)
 * @returns {{ declaration: string, point: string, spec: object } | { stop: string }}
 */
export function replacePlanOf(path, text, districts, { side: givenSide, owner: givenOwner } = {}) {
  const base = path.slice(path.lastIndexOf("/") + 1);
  const switchName = DEFAULT_FILE.exec(base)?.[1];
  if (!switchName) return { stop: "1 行スイッチの既定 <名前>.default.ts(x) の名前でない" };
  const owners = districts.filter((d) => path.startsWith(`${d.dir}/`)).sort((a, b) => b.dir.length - a.dir.length);
  const owner = givenOwner ? { dir: givenOwner.slice(0, givenOwner.lastIndexOf("/")) } : owners[0];
  if (!owner) {
    const frames = districts.filter((d) => d.kind === "frame" && path.startsWith(`${d.dir.slice(0, d.dir.lastIndexOf("/"))}/`)).sort((a, b) => b.dir.length - a.dir.length);
    const roots = districts.filter((d) => d.kind === "frame" && d.dir === "src/app/_layout");
    const candidates = [...frames, ...roots].map((d) => `${d.dir}/extensionPoints.ts`);
    return { stop: `持ち主の地区が無い(差替点を書く宣言を --owner ${path}=<宣言のパス> で決める。候補: ${[...new Set(candidates)].join(" / ") || "なし"})` };
  }
  const typeRef = contractTypeOf(path, text, switchName);
  if ("stop" in typeRef) return typeRef;
  const side = givenSide ?? (/^\s*["']use client["']/m.test(text) ? "client" : path.split("/").includes("server") ? "server" : null);
  if (!side) return { stop: `side が決まらない("use client" も /server/ も無い。--side ${path}=<client | server | shared> で決める)` };
  if (!["client", "server", "shared"].includes(side)) return { stop: `side ${side} は client | server | shared` };
  const point = switchName[0].toLowerCase() + switchName.slice(1);
  return { declaration: `${owner.dir}/extensionPoints.ts`, point, spec: { change: "replace", default: path, type: typeRef, side } };
}

/**
 * 既定の約束の型: <名前>Props の export → ただ 1 つの export type → export const <x>: <T> の T(import type の元。相対は @/ に直す)
 * @returns {{ from: string, name: string } | { stop: string }}
 */
export function contractTypeOf(path, text, switchName) {
  const types = [...text.matchAll(/^export\s+(?:type|interface)\s+([A-Za-z_$][\w$]*)/gm)].map((m) => m[1]);
  if (types.includes(`${switchName}Props`)) return { from: aliasOf(path), name: `${switchName}Props` };
  if (types.length === 1) return { from: aliasOf(path), name: types[0] };
  const annotated = /^export\s+const\s+[A-Za-z_$][\w$]*\s*:\s*([A-Za-z_$][\w$]*)/m.exec(text)?.[1];
  if (annotated) {
    for (const m of text.matchAll(/^import\s+(?:type\s+)?\{([^}]*)\}\s*from\s*["']([^"']+)["']/gm)) {
      const names = m[1].split(",").map((n) => n.replace(/^\s*type\s+/, "").trim());
      if (!names.includes(annotated)) continue;
      const spec = m[2];
      if (!spec.startsWith(".")) return { from: spec, name: annotated };
      const dir = path.slice(0, path.lastIndexOf("/"));
      const parts = dir.split("/");
      for (const seg of spec.split("/")) {
        if (seg === "..") parts.pop();
        else if (seg !== ".") parts.push(seg);
      }
      return { from: aliasOf(parts.join("/")), name: annotated };
    }
  }
  return { stop: `約束の型が決まらない(${switchName}Props を export する。export type の候補: ${types.join(" / ") || "なし"})` };
}

const RULES_DIR = "src/featureGate/rules";
const DOMAIN_CONFIG = /^@\/domains\/(?:core\/)?([^/]+)\/config$/;

/** ドメインの config.ts の木の中のパス(core と業務の両方を見る) */
const domainConfigPath = (root, domain) => [`src/domains/core/${domain}/config.ts`, `src/domains/${domain}/config.ts`].find((p) => existsSync(join(root, p))) ?? null;

/**
 * 1 つの規則の書き直し(純関数。config.ts の読みは readConfig で渡す)
 * @param {string} path
 * @param {string} text
 * @param {(domain: string) => { path: string, text: string } | null} readConfig
 * @returns {{ text: string, when: string[] } | { stop: string } | null} null = 値の import が無い
 */
export function rewriteRule(path, text, readConfig) {
  if (readRuleImports(text).length === 0) return null;
  const source = ts.createSourceFile(path, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const valueImports = source.statements.filter((s) => ts.isImportDeclaration(s) && ts.isStringLiteral(s.moduleSpecifier) && !s.importClause?.isTypeOnly && readRuleImports(s.getText(source)).length > 0);
  // import した名前 → { domain, exported, decl }
  const imported = new Map();
  for (const decl of valueImports) {
    const match = DOMAIN_CONFIG.exec(decl.moduleSpecifier.text);
    const named = decl.importClause?.namedBindings;
    if (!match || decl.importClause?.name || !named || !ts.isNamedImports(named)) {
      return { stop: `規則は値を import しない: ${decl.moduleSpecifier.text} を手で外す(ドメインの値は when: ["<ドメイン>.<名前>"]、住所は * で書く)` };
    }
    for (const e of named.elements) if (!e.isTypeOnly) imported.set(e.name.text, { domain: match[1], exported: (e.propertyName ?? e.name).text, decl });
  }
  // enabled: () => <名前> だけを when にできる
  let enabledProp = null;
  let hasWhen = false;
  const visit = (node) => {
    if (ts.isPropertyAssignment(node) && ts.isIdentifier(node.name)) {
      if (node.name.text === "when") hasWhen = true;
      if (node.name.text === "enabled") enabledProp = node;
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  const fn = enabledProp && ts.isArrowFunction(enabledProp.initializer) ? enabledProp.initializer : null;
  const ident = fn && ts.isIdentifier(fn.body) ? fn.body.text : null;
  const target = ident ? imported.get(ident) : undefined;
  const others = [...imported.keys()].filter((name) => name !== ident);
  if (!target || others.length > 0 || hasWhen) {
    const hints = [...imported.values()].map((i) => `${i.domain}.${i.exported}`);
    return { stop: `規則がドメインの値を読む形を自動で直せない(enabled: () => <名前> の 1 つだけを when にする。候補: when: [${hints.map((h) => JSON.stringify(h)).join(", ")}](真偽でない値は config.ts に export const <名前>: boolean を足して指す)、住所の組み立ては "/<区切り>/*/…" の * で)` };
  }
  const config = readConfig(target.domain);
  if (!config) return { stop: `when の候補 ${target.domain}.${target.exported}: ドメイン ${target.domain} の config.ts が無い` };
  if (!booleanExportsOf(config.path, config.text).booleans.has(target.exported)) {
    return { stop: `${config.path} の ${target.exported} が最上位の真偽の export でない(export const ${target.exported}: boolean = … と型を書いてから when: ["${target.domain}.${target.exported}"] に)` };
  }
  const ref = `${target.domain}.${target.exported}`;
  // 置き換え(後ろから): enabled → when、import の行を外す
  const edits = [
    { start: enabledProp.getStart(source), end: enabledProp.getEnd(), text: `when: [${JSON.stringify(ref)}]` },
    ...[...new Set([...imported.values()].map((i) => i.decl))].map((decl) => {
      let end = decl.getEnd();
      while (text[end] === "\n") end += 1;
      return { start: decl.getStart(source), end, text: "" };
    }),
  ].sort((a, b) => b.start - a.start);
  let out = text;
  for (const e of edits) out = out.slice(0, e.start) + e.text + out.slice(e.end);
  return { text: out, when: [ref] };
}

/** 門番の規則の書き直しの計画 */
export function planRules(root) {
  const rules = [];
  const stops = [];
  if (!existsSync(join(root, RULES_DIR))) return { rules, stops };
  const readConfig = (domain) => {
    const path = domainConfigPath(root, domain);
    return path ? { path, text: readFileSync(join(root, path), "utf8") } : null;
  };
  for (const name of readdirSync(join(root, RULES_DIR)).filter((f) => f.endsWith(".ts")).sort()) {
    const path = `${RULES_DIR}/${name}`;
    const result = rewriteRule(path, readFileSync(join(root, path), "utf8"), readConfig);
    if (result === null) continue;
    if ("stop" in result) stops.push({ path, point: null, text: `規則: ${result.stop}` });
    else rules.push({ path, when: result.when, text: result.text });
  }
  return { rules, stops };
}

/** 計画(何も書かない) */
export function planDeclarations(root, { sides = {}, owners = {} } = {}) {
  const edits = [];
  const stops = [];
  let files = 0;
  const texts = new Map();
  const srcFiles = listSrcFiles(root);
  for (const path of srcFiles.filter(isDeclarationPath)) {
    files += 1;
    const text = readFileSync(join(root, path), "utf8");
    const result = addChanges(path, text);
    texts.set(path, result.text);
    for (const s of result.stops) stops.push({ path, ...s });
    if (result.added.length > 0) edits.push({ path, added: result.added });
  }
  // 差替点: どの宣言の default にも無い既定
  const declared = new Set();
  const namesByFile = new Map();
  for (const [path, text] of texts) {
    const read = declaredNames(path, text);
    for (const d of read.defaults) declared.add(d);
    namesByFile.set(path, new Set(read.names));
  }
  const replaces = [];
  const defaults = srcFiles.filter((p) => DEFAULT_FILE.test(p.slice(p.lastIndexOf("/") + 1)) && !isClaimedDefault(p) && !declared.has(p));
  const districts = defaults.length > 0 ? readDistrictMapAt(root).districts : [];
  for (const path of defaults) {
    const plan = replacePlanOf(path, readFileSync(join(root, path), "utf8"), districts, { side: sides[path], owner: owners[path] });
    if ("stop" in plan) {
      stops.push({ path, point: null, text: `差替点: ${plan.stop}` });
      continue;
    }
    const names = namesByFile.get(plan.declaration) ?? new Set();
    if (names.has(plan.point)) {
      stops.push({ path, point: plan.point, text: `差替点: ${plan.declaration} に同じ名前の点 ${plan.point} がある(名前を決めて手で書く)` });
      continue;
    }
    names.add(plan.point);
    namesByFile.set(plan.declaration, names);
    replaces.push(plan);
  }
  const ruleRewrites = planRules(root);
  stops.push(...ruleRewrites.stops);
  return { files, edits, replaces, rules: ruleRewrites.rules, stops };
}

/** 計画を当てる(change の書き足し → 差替点の点の足し) */
export function applyDeclarations(root, plan) {
  for (const edit of plan.edits) {
    const abs = join(root, edit.path);
    writeFileSync(abs, addChanges(edit.path, readFileSync(abs, "utf8")).text);
  }
  const created = [];
  for (const r of plan.replaces ?? []) {
    const abs = join(root, r.declaration);
    if (!existsSync(abs)) {
      writeFileSync(abs, newDeclaration(r.declaration, r.point, r.spec));
      created.push(r.declaration);
      continue;
    }
    const added = addPoint(r.declaration, readFileSync(abs, "utf8"), r.point, r.spec);
    if ("problem" in added) throw new Error(`${r.declaration}: ${added.problem}`);
    writeFileSync(abs, added.text);
  }
  for (const r of plan.rules ?? []) writeFileSync(join(root, r.path), r.text);
  return { edited: plan.edits.length, replaced: (plan.replaces ?? []).length, created, rules: (plan.rules ?? []).length };
}

function main() {
  const args = process.argv.slice(2);
  const root = process.cwd();
  const apply = args.includes("--apply");
  /** --side <既定のパス>=<側>・--owner <既定のパス>=<宣言のパス>(止めた物を人が決める) */
  const given = (flag) => Object.fromEntries(args.flatMap((a, i) => (a === flag && args[i + 1] ? [args[i + 1].split("=")] : [])));
  const plan = planDeclarations(root, { sides: given("--side"), owners: given("--owner") });
  const result = { mode: apply ? "apply" : "dry-run", ...plan };
  if (apply) Object.assign(result, applyDeclarations(root, plan));
  if (args.includes("--json")) {
    console.log(JSON.stringify(result, null, 2));
    return;
  }
  const counts = {};
  for (const e of plan.edits) for (const a of e.added) counts[a.change] = (counts[a.change] ?? 0) + 1;
  console.log(`[declarations] ${result.mode}`);
  console.log(`宣言: ${plan.files} ファイル / 書き足す: ${plan.edits.length} ファイル(${Object.entries(counts).map(([k, n]) => `${k} ${n}`).join(" / ") || "なし"})`);
  console.log(`差替点を足す: ${plan.replaces.length} 点`);
  for (const r of plan.replaces) console.log(`  ${r.declaration} ${r.point} ← ${r.spec.default}(${r.spec.type.name}・${r.spec.side})`);
  console.log(`門番の規則を書き直す: ${plan.rules.length} 本`);
  for (const r of plan.rules) console.log(`  ${r.path}: enabled → when: ${JSON.stringify(r.when)}`);
  console.log(`止めた物(書かない): ${plan.stops.length} 件`);
  for (const s of plan.stops) console.log(`  ${s.path}${s.point ? ` ${s.point}` : ""}: ${s.text}`);
  if (apply) console.log("次: pnpm generate extensions・pnpm generate district-map");
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main();
