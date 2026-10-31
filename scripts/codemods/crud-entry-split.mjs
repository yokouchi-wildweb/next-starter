#!/usr/bin/env node
// scripts/codemods/crud-entry-split.mjs
// @/lib/crud の入口から UI が外れたので、ボタンの import を @/lib/crud/components へ振り分ける。
// 使い方(リポのルートで): node scripts/codemods/crud-entry-split.mjs
// 対象は呼び出したリポの src。何度走らせても同じ結果。読めない形(import * など)は書き換えず一覧を出す。

import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";

const OLD = "@/lib/crud";
const UI = "@/lib/crud/components";
const STATIC_IMPORT = /^([ \t]*)(import|export)(\s+type)?\s*\{([^}]*)\}\s*from\s*["']@\/lib\/crud["'];?/gm;
const UNREADABLE = /(?:import\s*\*\s*as\s+\w+\s*from|import\(|export\s*\*\s*from)\s*["']@\/lib\/crud["']/;

const isUi = (specifier) => /Button(Props)?$/.test(specifier.replace(/^type\s+/, "").split(/\s+as\s+/)[0].trim());

/**
 * 1 ファイルの中身を置き換える
 * @returns {{ text: string, skipped: string[] }}
 */
export function transformSource(source) {
  const text = source.replace(STATIC_IMPORT, (whole, indent, keyword, typeWord = "", list) => {
    const names = list.split(",").map((item) => item.trim()).filter(Boolean);
    const ui = names.filter(isUi);
    if (ui.length === 0) return whole;
    const rest = names.filter((name) => !isUi(name));
    const line = (items, target) => `${indent}${keyword}${typeWord} { ${items.join(", ")} } from "${target}";`;
    return rest.length > 0 ? `${line(rest, OLD)}\n${line(ui, UI)}` : line(ui, UI);
  });
  const skipped = text.split("\n").filter((line) => UNREADABLE.test(line)).map((line) => line.trim());
  return { text, skipped };
}

function walk(dir, found = []) {
  if (!existsSync(dir)) return found;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) walk(full, found);
    else if (/\.(ts|tsx|mts)$/.test(entry.name)) found.push(full);
  }
  return found;
}

/** リポの src を置き換える */
export function run(root) {
  const changed = [];
  const skipped = [];
  for (const file of walk(join(root, "src"))) {
    const source = readFileSync(file, "utf8");
    if (!source.includes(`"${OLD}"`)) continue;
    const rel = relative(root, file).split(sep).join("/");
    const result = transformSource(source);
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
    console.log(`書き換えなかった import(手で直す): ${skipped.length} 件`);
    for (const item of skipped) console.log(`  ${item}`);
  }
}
