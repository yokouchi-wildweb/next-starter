// scripts/structure/extensions/derive/gateSettingPaths.mjs
// 変換 "featureTables" の一部: 設定の節(src/features/core/setting/sections/<名前>.ts か <名前>/index.ts の export const section)の
// key と feature を字面で読み、規則名 → 閉じる住所 /admin/settings/<key> を導く(L1.17)。
// 節の住所は節自身の判定(D34 K4): 生成一覧の settingSections(住所・名指す機能)に載り、名指す機能が全部開のときだけ開く(src/featureGate/ruleList.ts)。
// 規則の生成一覧の項目の settingPaths は説明用(pnpm ops features list)で、pathPatterns には足さない。

import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

export const SETTING_SECTIONS_DIR = "src/features/core/setting/sections";
export const settingSectionHref = (key) => `/admin/settings/${key}`;

const strip = (text) => text.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^[ \t]*\/\/[^\n]*$/gm, "");
const KEY_FIELD = /(?:^|[{,\s])key\s*:\s*["']([^"']+)["']/;
const FEATURE_NAME = /(?:^|[{,\s])feature\s*:/;
const FEATURE_FIELD = /(?:^|[{,\s])feature\s*:\s*(\[[\s\S]*?\]|["'][^"'\n]*["'])/;
const STRING_LITERAL = /^["']([A-Za-z0-9_-]+)["']$/;

/**
 * 節のファイルの本文から key と feature(文字列リテラルか、その配列)を読む
 * @returns {{ key: string | null, features: string[] } | { problem: string }}
 */
export function readSectionFeature(text) {
  const body = strip(text);
  const key = KEY_FIELD.exec(body)?.[1] ?? null;
  if (!FEATURE_NAME.test(body)) return { key, features: [] };
  const feature = FEATURE_FIELD.exec(body);
  if (!feature) return { problem: "feature が文字列リテラルかその配列でない(規則名を直接書く)" };
  if (!key) return { problem: "feature を書いた節の key が文字列リテラルで読めない" };
  const raw = feature[1].trim();
  const single = STRING_LITERAL.exec(raw);
  if (single) return { key, features: [single[1]] };
  const array = /^\[([\s\S]*)\]$/.exec(raw);
  if (!array) return { problem: `feature が文字列リテラルかその配列でない(${raw})` };
  const features = [];
  for (const part of array[1].split(",").map((p) => p.trim()).filter(Boolean)) {
    const literal = STRING_LITERAL.exec(part);
    if (!literal) return { problem: `feature の要素 ${part} が文字列リテラルでない(規則名を直接書く)` };
    features.push(literal[1]);
  }
  return { key, features };
}

function sectionFiles(repoRoot) {
  const dir = join(repoRoot, SETTING_SECTIONS_DIR);
  if (!existsSync(dir)) return [];
  const files = [];
  for (const name of readdirSync(dir).sort()) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) {
      for (const index of ["index.ts", "index.tsx"]) if (existsSync(join(path, index))) files.push(`${SETTING_SECTIONS_DIR}/${name}/${index}`);
    } else if (/\.tsx?$/.test(name) && !/\.(override|test)\.tsx?$/.test(name)) files.push(`${SETTING_SECTIONS_DIR}/${name}`);
  }
  return files;
}

/**
 * 設定の節を走査する(1 回だけ)
 * @returns {{ problems: string[], pathsOf: (ruleName: string) => string[], sections: { path: string, features: string[] }[], unknownFeatures: (ruleNames: string[]) => string[] }}
 */
export function scanSettingSectionFeatures(repoRoot) {
  const problems = [];
  const byFeature = new Map();
  const uses = [];
  const sections = [];
  for (const file of sectionFiles(repoRoot)) {
    const read = readSectionFeature(readFileSync(join(repoRoot, file), "utf8"));
    if (read.problem) {
      problems.push(`${file}: ${read.problem}`);
      continue;
    }
    if (read.features.length > 0) sections.push({ path: settingSectionHref(read.key), features: [...read.features] });
    for (const feature of read.features) {
      byFeature.set(feature, [...(byFeature.get(feature) ?? []), settingSectionHref(read.key)]);
      uses.push({ file, feature });
    }
  }
  return {
    problems,
    pathsOf: (ruleName) => byFeature.get(ruleName) ?? [],
    sections: sections.sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0)),
    unknownFeatures: (ruleNames) => {
      const known = new Set(ruleNames);
      return uses.filter((use) => !known.has(use.feature)).map((use) => `${use.file}: feature の "${use.feature}" は機能を閉じる規則(src/featureGate/rules/)の名前でない`);
    },
  };
}
