#!/usr/bin/env node
// scripts/codemods/wiring-domains-split.mjs
// @/wiring/domains の import を、分割後の @/wiring/domainRegistry と @/wiring/adminScreenParts へ名前ごとに振り分ける。
// 使い方(リポのルートで): node scripts/codemods/wiring-domains-split.mjs
// 対象は呼び出したリポの src。何度走らせても同じ結果。読めない形(import * など)は書き換えず一覧を出す。

import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";

const OLD = "@/wiring/domains";
const REGISTRY = "@/wiring/domainRegistry";
const PARTS = "@/wiring/adminScreenParts";
const PARTS_NAMES = new Set([
  "adminListParts",
  "adminEditParts",
  "adminCreateParts",
  "adminSortParts",
  "AdminListScreenProps",
  "AdminEditScreenProps",
  "AdminEditScreenLoaded",
  "AdminCreateScreenLoaded",
]);

const STATIC_IMPORT = /^([ \t]*)(import|export)(\s+type)?\s*\{([^}]*)\}\s*from\s*["']@\/wiring\/domains["'];?/gm;
const DYNAMIC_IMPORT = /\{([^}]*)\}\s*=\s*await\s+import\(\s*["']@\/wiring\/domains["']\s*\)/g;

const targetOf = (specifier) => (PARTS_NAMES.has(specifier.replace(/^type\s+/, "").split(/\s+as\s+/)[0].trim()) ? PARTS : REGISTRY);

function splitSpecifiers(list) {
  const groups = new Map();
  for (const specifier of list.split(",").map((item) => item.trim()).filter(Boolean)) {
    const target = targetOf(specifier);
    groups.set(target, [...(groups.get(target) ?? []), specifier]);
  }
  return groups;
}

/**
 * 1 ファイルの中身を置き換える
 * @returns {{ text: string, skipped: string[] }}
 */
export function transformSource(source) {
  const skipped = [];
  let text = source.replace(STATIC_IMPORT, (_, indent, keyword, typeWord = "", list) =>
    [...splitSpecifiers(list)]
      .map(([target, names]) => `${indent}${keyword}${typeWord} { ${names.join(", ")} } from "${target}";`)
      .join("\n"),
  );
  text = text.replace(DYNAMIC_IMPORT, (whole, list) => {
    const groups = splitSpecifiers(list);
    // 2 つの行き先にまたがる動的 import は残し、下の一覧に出す
    return groups.size === 1 ? whole.replace(OLD, [...groups.keys()][0]) : whole;
  });
  for (const line of text.split("\n")) {
    if (/from\s*["']@\/wiring\/domains["']|^\s*import\s*["']@\/wiring\/domains["']|import\(\s*["']@\/wiring\/domains["']\s*\)/.test(line)) {
      skipped.push(line.trim());
    }
  }
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
    if (!source.includes(OLD)) continue;
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
