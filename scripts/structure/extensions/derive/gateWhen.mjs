// scripts/structure/extensions/derive/gateWhen.mjs
// 機能を閉じる規則の when: ["<ドメイン>.<名前>", …](全部 AND、D28)を字面で読み、指された値を確かめ、指された config.ts だけを import する一覧
// src/featureGate/extensions/whenInputs.ts を組む(derive featureTables の一部)。規則は機能の定義だけを持ち、ドメインの値は名前で指すだけ(D23・D29)。
// 指せる値: ドメインの config.ts の最上位の export const <名前>: boolean(型注釈 boolean か true / false のリテラル)。入れ子の鍵・関数・真偽でない値は不可。
// 止める物: 文字列リテラルの配列でない書き方・<ドメイン>.<名前> の形でない・重複(readWhen)/ 知らないドメイン・config.ts が無い・名前が無い・真偽でない(checkWhenRef)/
// 規則のファイルの値の import(import type だけ。enabled() は環境変数と定数だけ、readRuleImports)/ 住所のパターンの書き方の誤り(readPathPatternProblems)。
// 評価は src/featureGate/ruleList.ts の 1 か所(指した値の持ち主のドメインが閉じても値は読むだけ、D28)

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import ts from "typescript";

import { patternProblem } from "../../../../src/lib/pathPattern/index.mjs";

const WHEN_FIELD = /(?:^|[{,\s])when\s*:\s*\[([\s\S]*?)\]/;
const WHEN_KEY = /(?:^|[{,\s])when\s*:/;
const PATTERNS_FIELD = /(?:^|[{,\s])pathPatterns\s*:\s*\[([\s\S]*?)\]/;
const REF_LITERAL = /^["']([a-z][A-Za-z0-9]*)\.([A-Za-z_$][A-Za-z0-9_$]*)["']$/;
const STRING_LITERAL = /^["']([^"']*)["']$/;
const stripComments = (text) => text.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"'`])\/\/[^\n]*/g, "$1");

/** 生成物の置き場(門番の extensions/) */
export const WHEN_INPUTS_NAME = "whenInputs";

/**
 * 規則ファイルの when: [...] を字面で読む(文字列リテラル "<ドメイン>.<名前>" の配列だけ、重複は止める)
 * @param {string} text
 * @returns {{ when: string[] } | { problem: string }}
 */
export function readWhen(text) {
  const body = stripComments(text);
  const match = WHEN_FIELD.exec(body);
  if (!match) return WHEN_KEY.test(body) ? { problem: 'when が文字列リテラルの配列でない(["<ドメイン>.<名前>"] の形で直接書く)' } : { when: [] };
  const when = [];
  for (const part of match[1].split(",").map((p) => p.trim()).filter(Boolean)) {
    const literal = REF_LITERAL.exec(part);
    if (!literal) return { problem: `when の要素 ${part} が "<ドメイン>.<名前>" の文字列リテラルでない(ドメインの config.ts の最上位の真偽の export を指す。入れ子の鍵は指せない)` };
    const ref = `${literal[1]}.${literal[2]}`;
    if (when.includes(ref)) return { problem: `when の "${ref}" が重複している` };
    when.push(ref);
  }
  return { when };
}

/**
 * 規則ファイルの値の import(規則は機能の定義だけ。import type 以外は止める、D28・D29)
 * @param {string} text
 * @returns {string[]} 値で import している import 元
 */
export function readRuleImports(text) {
  const source = ts.createSourceFile("rule.ts", text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const values = [];
  for (const statement of source.statements) {
    if (!ts.isImportDeclaration(statement) || !ts.isStringLiteral(statement.moduleSpecifier)) continue;
    const clause = statement.importClause;
    if (clause?.isTypeOnly) continue;
    const named = clause?.namedBindings && ts.isNamedImports(clause.namedBindings) ? clause.namedBindings.elements : null;
    if (clause && !clause.name && named && named.length > 0 && named.every((e) => e.isTypeOnly)) continue;
    values.push(statement.moduleSpecifier.text);
  }
  return values;
}

/**
 * 規則ファイルの pathPatterns の書き方の誤り(文字列リテラルの要素だけ見る。読めない要素は数えない)
 * @param {string} text
 * @returns {string[]}
 */
export function readPathPatternProblems(text) {
  const match = PATTERNS_FIELD.exec(stripComments(text));
  if (!match) return [];
  return match[1]
    .split(",")
    .map((p) => STRING_LITERAL.exec(p.trim())?.[1])
    .filter((p) => p !== undefined)
    .map((p) => patternProblem(p))
    .filter((p) => p !== null);
}

/**
 * config.ts の最上位の export const の真偽の名前(型注釈 boolean か、型注釈の無い true / false)と、それ以外の最上位の export const の名前
 * @param {string} path
 * @param {string} text
 */
export function booleanExportsOf(path, text) {
  const source = ts.createSourceFile(path, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const booleans = new Set();
  const others = new Set();
  for (const statement of source.statements) {
    if (!ts.isVariableStatement(statement) || !statement.modifiers?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword)) continue;
    for (const d of statement.declarationList.declarations) {
      if (!ts.isIdentifier(d.name)) continue;
      const typed = d.type?.kind === ts.SyntaxKind.BooleanKeyword;
      const literal = !d.type && d.initializer && (d.initializer.kind === ts.SyntaxKind.TrueKeyword || d.initializer.kind === ts.SyntaxKind.FalseKeyword);
      (typed || literal ? booleans : others).add(d.name.text);
    }
  }
  return { booleans, others };
}

/**
 * when の 1 つの値を確かめる
 * @param {string} repoRoot
 * @param {Map<string, { dir: string }>} domainsByName ドメインの名前 → 地区(地区の地図の domains)
 * @param {string} ref "<ドメイン>.<名前>"
 * @param {Map<string, ReturnType<typeof booleanExportsOf> | null>} cache config.ts の読み(ドメインの dir → 読み)
 * @returns {{ ref: string, domain: string, name: string, configPath: string } | { problem: string }}
 */
export function checkWhenRef(repoRoot, domainsByName, ref, cache) {
  const [domain, name] = ref.split(".");
  const district = domainsByName.get(domain);
  if (!district) return { problem: `when の "${ref}": ドメイン ${domain} が無い(src/domains/<名前> か src/domains/core/<名前> のフォルダ名)` };
  const configPath = `${district.dir}/config.ts`;
  if (!cache.has(district.dir)) {
    const abs = join(repoRoot, configPath);
    cache.set(district.dir, existsSync(abs) ? booleanExportsOf(configPath, readFileSync(abs, "utf8")) : null);
  }
  const read = cache.get(district.dir);
  if (!read) return { problem: `when の "${ref}": ${configPath} が無い(指せるのはドメインの config.ts の最上位の真偽の export)` };
  if (read.others.has(name)) return { problem: `when の "${ref}": ${configPath} の ${name} が真偽でない(export const ${name}: boolean = … と型を書く。入れ子の鍵は指せない)` };
  if (!read.booleans.has(name)) return { problem: `when の "${ref}": ${configPath} に最上位の export const ${name} が無い(改名・削除なら上流の notice の旧 → 新を見る)` };
  return { ref, domain, name, configPath };
}

/**
 * 生成物 whenInputs.ts の本文(指された config.ts だけを import する)
 * @param {(line: string) => string} headerFor
 * @param {string} source 宣言のファイル
 * @param {{ ref: string, domain: string, name: string, configPath: string }[]} refs 規則が指した値(重複は除いて並べる)
 */
export function renderWhenInputs(header, refs) {
  const unique = [...new Map(refs.map((r) => [r.ref, r])).values()].sort((a, b) => (a.ref < b.ref ? -1 : 1));
  const alias = (r) => `${r.domain}_${r.name}`;
  const specifier = (r) => `@/${r.configPath.slice("src/".length).replace(/\.ts$/, "")}`;
  const lines = [header, "// whenInputs: 規則の when が指したドメインの config.ts の最上位の真偽の export だけ(指された config だけを import する。評価は ../ruleList.ts)", ""];
  for (const r of unique) lines.push(`import { ${r.name} as ${alias(r)} } from ${JSON.stringify(specifier(r))};`);
  if (unique.length > 0) lines.push("");
  const entries = unique.map((r) => `  ${JSON.stringify(r.ref)}: ${alias(r)},`);
  lines.push(`export const ${WHEN_INPUTS_NAME}: Readonly<Record<string, boolean>> = ${entries.length === 0 ? "{}" : `{\n${entries.join("\n")}\n}`};`, "");
  return lines.join("\n");
}
