#!/usr/bin/env node
// scripts/codemods/domain-display-buttons.mjs
// lib/crud のボタンの domain="<ドメイン名>" を domain={<ドメイン名>Display}(表示用の写し)へ置き換える。
// 使い方(リポのルートで): node scripts/codemods/domain-display-buttons.mjs
// 対象は呼び出したリポの src。何度走らせても同じ結果。読めない呼び(動的な domain・写しの無いドメイン)は書き換えず一覧を出す。

import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";

const BUTTONS = [
  "DeleteButton",
  "DuplicateButton",
  "EditButton",
  "CreateButton",
  "BulkDeleteButton",
  "BulkEnumFieldButton",
  "HardDeleteButton",
  "EnumFieldButton",
  "BelongsToFieldButton",
  "BelongsToManyFieldButton",
  "BulkBelongsToFieldButton",
  "BulkBelongsToManyFieldButton",
];
const TAG_START = new RegExp(`<(${BUTTONS.join("|")})\\b`, "g");
const SKIP = ["src/lib/crud/components/Buttons/", "src/features/_template/"];

const toCamel = (name) => name.replace(/[_-](\w)/g, (_, char) => char.toUpperCase());
const toPosix = (path) => path.split(sep).join("/");

function walk(dir, found = []) {
  if (!existsSync(dir)) return found;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) walk(full, found);
    else found.push(full);
  }
  return found;
}

/** フォルダ名(camelCase) → 写しの import 先。写しのファイルがあるドメインだけ */
export function findDisplays(root) {
  const displays = new Map();
  for (const file of walk(join(root, "src/features"))) {
    const rel = toPosix(relative(root, file));
    const match = /^src\/(features\/(?:.+\/)?([^/]+))\/entities\/display\.ts$/.exec(rel);
    if (match) displays.set(match[2], `@/${match[1]}/entities/display`);
  }
  return displays;
}

/** タグの属性の終わり(波括弧の外の > か />)の位置。入れ子の {} と文字列を飛ばす */
function attributesEnd(source, from) {
  let depth = 0;
  let quote = null;
  for (let i = from; i < source.length; i += 1) {
    const char = source[i];
    if (quote) {
      if (char === quote) quote = null;
    } else if (char === '"' || char === "'" || char === "`") {
      quote = char;
    } else if (char === "{") {
      depth += 1;
    } else if (char === "}") {
      depth -= 1;
    } else if (char === ">" && depth === 0) {
      return source[i - 1] === "/" ? i - 1 : i;
    }
  }
  return source.length;
}

/**
 * 1 ファイルの中身を置き換える
 * @returns {{ text: string, skipped: string[] }}
 */
export function transformSource(source, displays) {
  const skipped = [];
  const added = new Map();
  let text = "";
  let cursor = 0;
  for (const match of source.matchAll(TAG_START)) {
    const name = match[1];
    const attrStart = match.index + match[0].length;
    if (attrStart < cursor) continue;
    const attrEnd = attributesEnd(source, attrStart);
    const attributes = source.slice(attrStart, attrEnd);
    const dynamic = /(?:^|\s)domain=\{/.exec(attributes);
    if (dynamic) {
      const value = /^[^}]*/.exec(attributes.slice(dynamic.index + dynamic[0].length))[0];
      if (!/Display$/.test(value.trim())) skipped.push(`<${name} domain={${value}}>`);
      continue;
    }
    const literal = /(?:^|\s)domain="([^"]+)"/.exec(attributes);
    if (!literal) continue;
    const camel = toCamel(literal[1]);
    const from = displays.get(camel);
    if (!from) {
      skipped.push(`<${name} domain="${literal[1]}">(写しが無い)`);
      continue;
    }
    const local = `${camel}Display`;
    added.set(local, from);
    const at = attrStart + literal.index + literal[0].indexOf("domain=");
    text += `${source.slice(cursor, at)}domain={${local}}`;
    cursor = at + `domain="${literal[1]}"`.length;
  }
  text += source.slice(cursor);
  if (added.size === 0) return { text, skipped };
  const lines = [...added]
    .filter(([local]) => !new RegExp(`\\bas ${local}\\b`).test(text))
    .map(([local, from]) => `import { domainDisplay as ${local} } from "${from}";`);
  if (lines.length === 0) return { text, skipped };
  // 最後の import 文の直後へ
  const imports = [...text.matchAll(/^import\b[\s\S]*?from\s+["'][^"']+["'];?[ \t]*$/gm)];
  const at = imports.length > 0 ? imports.at(-1).index + imports.at(-1)[0].length : 0;
  const glue = imports.length > 0 ? "\n" : "";
  return { text: `${text.slice(0, at)}${glue}${lines.join("\n")}${imports.length > 0 ? "" : "\n"}${text.slice(at)}`, skipped };
}

/** リポの src を置き換える */
export function run(root) {
  const displays = findDisplays(root);
  const changed = [];
  const skipped = [];
  for (const file of walk(join(root, "src"))) {
    const rel = toPosix(relative(root, file));
    if (!rel.endsWith(".tsx") || SKIP.some((prefix) => rel.startsWith(prefix))) continue;
    const source = readFileSync(file, "utf8");
    const result = transformSource(source, displays);
    if (result.text !== source) {
      writeFileSync(file, result.text);
      changed.push(rel);
    }
    for (const item of result.skipped) skipped.push(`${rel}: ${item}`);
  }
  return { changed, skipped };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { changed, skipped } = run(process.cwd());
  console.log(`書き換え: ${changed.length} ファイル`);
  for (const file of changed) console.log(`  ${file}`);
  if (skipped.length > 0) {
    console.log(`書き換えなかった呼び(手で写しを渡す): ${skipped.length} 件`);
    for (const item of skipped) console.log(`  ${item}`);
  }
}
