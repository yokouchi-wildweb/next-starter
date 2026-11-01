#!/usr/bin/env node
// scripts/codemods/domain-json-client-display.mjs
// client のコードの domain.json の import(と normalizeDomainJsonConfig)を、写し entities/display.ts の domainDisplay へ置き換える。
// 対象の判定は lint 規則 import-boundaries/client-no-domain-json と同じ isClientCodeFile。
// 使い方(リポのルートで): node scripts/codemods/domain-json-client-display.mjs
// 対象は呼び出したリポの src。何度走らせても同じ結果。
// 確かめられないファイル(写しに無いキーを読む・写しの外へ丸ごと渡す・写しの無いドメイン・import() 等)は書き換えず一覧に出す。
// 一覧のファイルは手で移す。写しに無いキーが要るなら理由を書いて eslint-disable する。

import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";

import { isClientCodeFile } from "../../eslint-rules/import-boundaries.mjs";
import { resolveImport } from "../../eslint-rules/resolve-import.mjs";

/** 写しにある top のキー(src/lib/domain/types/display.ts の DomainDisplay) */
const DISPLAY_KEYS = new Set([
  "singular", "plural", "label", "fields", "relations", "searchFields", "useCreatedAt", "useUpdatedAt", "useSoftDelete",
  "useImportExport", "sortOrderField", "fieldGroups", "tableFields",
]);
/** 写しの field に無い、部品が読みそうな項目(F4) */
const FIELD_KEYS_NOT_COPIED = /\.(uploadPath|metadataBinding)\b/;
/** 丸ごと渡してよい受け口 */
const WHOLE_VALUE_BEFORE = /(?:buildFormDefaultValues|useRelationOptions)\(\s*$|\bconfig:\s*$|\bdomain=\{\s*$/;
const SKIP = ["src/features/_template/"];

const toPosix = (path) => path.split(sep).join("/");
const escape = (text) => text.replace(/[$]/g, "\\$&");

function walk(dir, found = []) {
  if (!existsSync(dir)) return found;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) walk(full, found);
    else found.push(full);
  }
  return found;
}

/** コメントを同じ長さの空白に(位置を保つ) */
function maskComments(source) {
  return source.replace(/("(?:[^"\\\n]|\\.)*"|'(?:[^'\\\n]|\\.)*')|\/\/[^\n]*|\/\*[\s\S]*?\*\//g, (match, string) =>
    string ?? match.replace(/[^\n]/g, " "),
  );
}

/** 文字列の中身も空白に(名前の探索用。位置を保つ) */
const maskStrings = (masked) => masked.replace(/"(?:[^"\\\n]|\\.)*"|'(?:[^'\\\n]|\\.)*'/g, (match) => match.replace(/[^\n]/g, " "));

/** 名前の出現の位置(プロパティ・文字列・コメント・オブジェクトのキーを除く) */
function wordPositions(source, name) {
  const code = maskStrings(maskComments(source));
  const positions = [];
  for (const match of code.matchAll(new RegExp(`(?<![\\w$.])${escape(name)}(?![\\w$])`, "g"))) {
    const isKey = /^\s*:(?!:)/.test(code.slice(match.index + name.length)) && /[{,(]\s*$|^\s*$/.test(code.slice(0, match.index));
    if (!isKey) positions.push(match.index);
  }
  return positions;
}

const IMPORT_RE = /^import\s+([\w$]+)\s+from\s+["']([^"']*domain\.json)["'];?[ \t]*\n/gm;
const NORMALIZE_IMPORT = /^import\s+\{\s*normalizeDomainJsonConfig\s*\}\s+from\s+["'][^"']+["'];?[ \t]*\n/m;

/** 1 つの名前の使い方を確かめる。読めない使い方なら理由、良ければ null */
function checkUses(masked, name) {
  for (const index of wordPositions(masked, name)) {
    const before = masked.slice(0, index);
    const after = masked.slice(index + name.length);
    if (/^\s*from\b/.test(after) && /import\s+$/.test(before)) continue; // import 文そのもの
    if (/normalizeDomainJsonConfig\(\s*$/.test(before)) continue;
    if (/^\s*=\s*normalizeDomainJsonConfig\(/.test(after)) continue;
    const property = /^\)?\s*\??\.\s*([\w$]+)/.exec(after) ?? /^\s+as\s+any\s*\)\s*\??\.\s*([\w$]+)/.exec(after) ?? /^\s*\[\s*["']([^"']+)["']\s*\]/.exec(after);
    if (property) {
      if (!DISPLAY_KEYS.has(property[1])) return `写しに無いキー ${property[1]} を読む`;
      continue;
    }
    const inCheck = /["']([^"']+)["']\s+in\s+$/.exec(before);
    if (inCheck) {
      if (!DISPLAY_KEYS.has(inCheck[1])) return `写しに無いキー ${inCheck[1]} を読む`;
      continue;
    }
    if (WHOLE_VALUE_BEFORE.test(before)) continue;
    if (name === "config" && /(^|\n)\s*$/.test(before) && /^,\s*\n/.test(after)) continue; // buildDomainColumns({ config, … })
    return `${name} を写しの外へ渡している(${masked.slice(index, index + 40).split("\n")[0]})`;
  }
  return null;
}

/**
 * 1 ファイルの中身を置き換える
 * @param {string} source
 * @param {(specifier: string) => string | null} displayOf domain.json の指定子 → 写しの import 先(無ければ null)
 * @returns {{ text: string, skipped: string[] }}
 */
export function transformSource(source, displayOf) {
  const imports = [...source.matchAll(IMPORT_RE)];
  const masked = maskComments(source);
  const skipped = (reason) => ({ text: source, skipped: [reason] });
  const withoutImports = imports.reduce((text, match) => text.replace(match[0], ""), masked);
  if (/domain\.json["']/.test(withoutImports)) return skipped("import() や export from や名前付きで読む");
  if (imports.length === 0) return { text: source, skipped: [] };
  if (FIELD_KEYS_NOT_COPIED.test(masked)) return skipped("写しに無い field の項目(uploadPath・metadataBinding)を読む");

  let text = source;
  for (const [statement, name, specifier] of imports) {
    const from = displayOf(specifier);
    if (!from) return skipped(`写しが無い(${specifier})`);
    const aliases = [...masked.matchAll(new RegExp(`const\\s+([\\w$]+)\\s*=\\s*normalizeDomainJsonConfig\\(\\s*${escape(name)}\\s*\\)\\s*;?`, "g"))].map((m) => m[1]);
    for (const used of [name, ...aliases]) {
      const reason = checkUses(masked, used);
      if (reason) return skipped(reason);
    }
    const existing = new RegExp(`import\\s+\\{\\s*domainDisplay(?:\\s+as\\s+([\\w$]+))?\\s*\\}\\s+from\\s+["']${from}["']`).exec(text);
    const folder = /([^/]+)\/entities\/display$/.exec(from)[1];
    const local = existing ? existing[1] ?? "domainDisplay" : `${folder}Display`;
    if (!existing && new RegExp(`(?<![\\w$.])${escape(local)}(?![\\w$])`).test(masked)) return skipped(`名前 ${local} が既にある`);
    text = text.replace(statement, existing ? "" : `import { domainDisplay as ${local} } from "${from}";\n`);
    for (const alias of aliases) {
      text = text.replace(new RegExp(`\\n?const\\s+${escape(alias)}\\s*=\\s*normalizeDomainJsonConfig\\(\\s*${escape(name)}\\s*\\)\\s*;?[ \\t]*\\n`), "\n");
    }
    for (const used of [name, ...aliases]) {
      for (const index of wordPositions(text, used).reverse()) {
        const shorthand = used === "config" && /(^|\n)\s*$/.test(text.slice(0, index)) && /^,\s*\n/.test(text.slice(index + used.length));
        text = `${text.slice(0, index)}${shorthand ? `config: ${local}` : local}${text.slice(index + used.length)}`;
      }
    }
  }
  if (!/normalizeDomainJsonConfig\(/.test(text)) text = text.replace(NORMALIZE_IMPORT, "");
  return { text, skipped: [] };
}

/** リポの src を置き換える */
export function run(root) {
  const changed = [];
  const skipped = [];
  for (const file of walk(join(root, "src"))) {
    const rel = toPosix(relative(root, file));
    if (!/\.tsx?$/.test(rel) || SKIP.some((prefix) => rel.startsWith(prefix))) continue;
    const source = readFileSync(file, "utf8");
    if (!source.includes("domain.json") || !isClientCodeFile(rel, source)) continue;
    const displayOf = (specifier) => {
      const resolved = resolveImport(specifier, file, root);
      if (!resolved?.startsWith("src/")) return null;
      const dir = resolved.replace(/\/domain\.json$/, "");
      return existsSync(join(root, dir, "entities/display.ts")) ? `@/${dir.slice("src/".length)}/entities/display` : null;
    };
    const result = transformSource(source, displayOf);
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
    console.log(`書き換えなかったファイル(手で移す): ${skipped.length} 件`);
    for (const item of skipped) console.log(`  ${item}`);
  }
}
