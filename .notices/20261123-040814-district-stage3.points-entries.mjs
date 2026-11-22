#!/usr/bin/env node
// .notices/20261123-040814-district-stage3.points-entries.mjs
// 差す側の項目が点の約束の型を「型だけの入口」から読むように書き換える(地区の議会 段 3、D33、注文 37)。上流(Tier1)も fork も同じ道具で、リポのルートで走らせる。
// (区切り district-stage3 の notice 20261123-040814-district-stage3 の道具)
// 使い方: node .notices/20261123-040814-district-stage3.points-entries.mjs [--apply] [--json]
//   既定は dry-run(書き換えの表を出すだけ、何も書かない)。--apply で書く。2 回目は何もしない
//
// 型だけの入口 = ゲートの無い地区(lib・枠・proxies・門番、ドメインでない持ち主)が持つ点の約束の型だけを出すファイル <持ち主>/points.ts
// (lib は入口 "./points"、ほかは @/<持ち主>/points)。どの持ち主が入口を持つかは宣言(extensionPoints.ts の type.from が <持ち主>/points)から読む。
// 対象: 項目のファイル(src の下の plugs/ の中の .ts・.tsx・.mts。テストを含む)の import { … } from "<持ち主の中のどこか>" のうち、
//   名前が入口の出す型の物。import type { … } に分けて入口から読む(値の名前は元の import に残す。名前だけになった元の import は消す)
// 決めない物: default・namespace の import(import X, { … } / import * as X)に入口の型が混じる → 止めて手で直す
// 入口のファイルの中・項目でないファイルは書かない

import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { collectPoints } from "../src/lib/districtMap/node.mjs";

export const POINTS_FILE = "points";
const DOMAINS_ROOT = "src/domains/";

/** 入口のファイルの出す型の名前(export type { A, B } from …・export type A = …) */
export function pointsExportsOf(text) {
  const names = new Set();
  for (const m of text.matchAll(/export\s+type\s*\{([^}]*)\}/g)) for (const part of m[1].split(",")) if (part.trim()) names.add(part.trim().split(/\s+as\s+/).pop().trim());
  for (const m of text.matchAll(/export\s+type\s+([A-Za-z_$][\w$]*)/g)) names.add(m[1]);
  return names;
}

/**
 * 型だけの入口の一覧: 宣言の type.from が <持ち主>/points の点の持ち主(ドメインでない)
 * @returns {{ alias: string, entry: string, names: Set<string> }[]} alias = 持ち主の @/ の名前、entry = 入口
 */
export function pointsEntriesOf(root, points) {
  const entries = new Map();
  for (const p of points) {
    if (p.owner.startsWith(DOMAINS_ROOT) || !p.spec.type) continue;
    const alias = `@/${p.owner.slice("src/".length)}`;
    const entry = `${alias}/${POINTS_FILE}`;
    if (p.spec.type.from !== entry || entries.has(entry)) continue;
    const file = ["ts", "tsx"].map((ext) => join(root, `${p.owner}/${POINTS_FILE}.${ext}`)).find((f) => existsSync(f));
    if (!file) continue;
    entries.set(entry, { alias, entry, names: pointsExportsOf(readFileSync(file, "utf8")) });
  }
  return [...entries.values()].sort((a, b) => b.alias.length - a.alias.length);
}

const NAMED_IMPORT = /import\s+(type\s+)?\{([^}]*)\}\s*from\s*["']([^"']+)["'];?[ \t]*\n?/g;
const OTHER_IMPORT = /import\s+(?:type\s+)?(?:[A-Za-z_$][\w$]*\s*,\s*\{([^}]*)\}|\*\s+as\s+[A-Za-z_$][\w$]*)\s*from\s*["']([^"']+)["']/g;

/**
 * 1 ファイルの書き換え
 * @returns {{ text: string, moved: { from: string, entry: string, names: string[] }[], stops: string[] }}
 */
export function rewriteItem(text, entries) {
  const entryOf = (source) => entries.find((e) => source === e.alias || source.startsWith(`${e.alias}/`)) ?? null;
  const stops = [];
  for (const m of text.matchAll(OTHER_IMPORT)) {
    const e = entryOf(m[2]);
    if (!e || m[2] === e.entry) continue;
    const names = (m[1] ?? "").split(",").map((s) => s.trim().replace(/^type\s+/, "").split(/\s+as\s+/)[0]).filter(Boolean);
    if (m[1] === undefined || names.some((n) => e.names.has(n))) stops.push(`${m[2]}: default・namespace の import に ${e.entry} の型が混じりうる(手で import type { … } from "${e.entry}" に分ける)`);
  }
  const moved = [];
  const add = new Map();
  const out = text.replace(NAMED_IMPORT, (whole, typeOnly, list, source) => {
    const e = entryOf(source);
    if (!e || source === e.entry) return whole;
    const specs = list.split(",").map((s) => s.trim()).filter(Boolean);
    const isType = (spec) => Boolean(typeOnly) || spec.startsWith("type ");
    const bare = (spec) => spec.replace(/^type\s+/, "");
    const take = specs.filter((spec) => e.names.has(bare(spec).split(/\s+as\s+/)[0]));
    if (take.length === 0) return whole;
    const keep = specs.filter((spec) => !take.includes(spec));
    moved.push({ from: source, entry: e.entry, names: take.map(bare) });
    add.set(e.entry, [...(add.get(e.entry) ?? []), ...take.map(bare)]);
    if (keep.length === 0) return "";
    const kept = keep.map((spec) => (typeOnly ? bare(spec) : spec)).join(", ");
    return `import ${typeOnly ? "type " : ""}{ ${kept} } from "${source}";\n`;
  });
  if (moved.length === 0) return { text, moved, stops };
  const lines = [...add].map(([entry, names]) => `import type { ${[...new Set(names)].sort().join(", ")} } from "${entry}";\n`).join("");
  // 足す位置: 最後の import 文の後(無ければ先頭のコメントの後)
  const lastImport = [...out.matchAll(/^import[\s\S]*?from\s*["'][^"']+["'];?[ \t]*\n/gm)].pop();
  const at = lastImport ? lastImport.index + lastImport[0].length : (/^(?:\/\/.*\n)*\n?/.exec(out)?.[0].length ?? 0);
  return { text: out.slice(0, at) + lines + out.slice(at), moved, stops };
}

function* walkPlugs(dir, inPlugs = false) {
  if (!existsSync(dir)) return;
  for (const name of readdirSync(dir)) {
    if (name === "node_modules" || name.startsWith(".")) continue;
    const path = join(dir, name);
    if (statSync(path).isDirectory()) yield* walkPlugs(path, inPlugs || name === "plugs");
    else if (inPlugs && /\.(tsx?|mts)$/.test(name)) yield path;
  }
}

/** @returns {{ files: { path: string, moved: object[], stops: string[], text: string }[] }} */
export function plan(root) {
  const { points } = collectPoints(root);
  const entries = pointsEntriesOf(root, points);
  const files = [];
  for (const abs of walkPlugs(join(root, "src"))) {
    const text = readFileSync(abs, "utf8");
    const r = rewriteItem(text, entries);
    if (r.moved.length > 0 || r.stops.length > 0) files.push({ path: abs.slice(root.length + 1).split("\\").join("/"), ...r });
  }
  return { entries: entries.map((e) => e.entry), files };
}

/** 計画を書く(止めた物のあるファイルは書かない)。書いたファイルを返す */
export function applyPointsEntries(root, result) {
  const written = [];
  for (const f of result.files) if (f.stops.length === 0) {
    writeFileSync(join(root, f.path), f.text);
    written.push(f.path);
  }
  return written;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const root = process.cwd();
  const apply = process.argv.includes("--apply");
  const result = plan(root);
  if (process.argv.includes("--json")) console.log(JSON.stringify({ entries: result.entries, files: result.files.map(({ text, ...f }) => f) }, null, 2));
  else {
    console.log(`型だけの入口: ${result.entries.join(" ・ ") || "(無い)"}`);
    for (const f of result.files) {
      for (const m of f.moved) console.log(`  ${f.path}: ${m.names.join(", ")}  ${m.from} → ${m.entry}`);
      for (const s of f.stops) console.log(`  止める ${f.path}: ${s}`);
    }
    console.log(`項目 ${result.files.length} ファイル(止める ${result.files.filter((f) => f.stops.length > 0).length})${apply ? "" : "。dry-run: --apply で書く"}`);
  }
  if (apply) applyPointsEntries(root, result);
  if (result.files.some((f) => f.stops.length > 0)) process.exitCode = 1;
}
