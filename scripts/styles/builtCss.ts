// scripts/styles/builtCss.ts
//
// ビルド済み CSS の検査(pnpm styles:check-build)の純粋ロジック。CLI は check-built-css.ts。
//
// 守りたい契約:
//   global.css から @import で辿れる全ファイルが、ビルド出力(.next/static/**/*.css)に取り込まれている。
//
// 背景: Vercel が古いビルドキャッシュを復元すると、キャッシュ作成後に足された @import 先が
// 出力 CSS から黙って抜けることがある(ローカル dev・ローカル build は正常、本番だけ崩れる)。
// 原因の内部挙動は外から確定できないため、原因ではなく「出力が正しいか」を見る。
//
// 判定: 各ファイルが @theme / @utility の外で宣言する CSS カスタムプロパティ(--x:)が、
// 出力 CSS に 1 つ残らず現れること。@theme 内の変数は使われたものしか出力されず、
// @utility の中身は未使用なら削られるため対象外。値は minifier が書き換える(oklch → hex 等)ので
// 名前だけを見る。
//
// 限界: 既に他のファイルが宣言している名前だけを上書きするファイル(src/styles/palette.css で --primary
// だけ変える等)は、抜けても名前は残るので検出できない。そのファイルは「検証不能」として警告する。
// 1 つでもそのファイル固有の名前(fork 独自の変数)を宣言すれば検証対象になる。

import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

/** コメントを除く */
export function stripComments(css: string): string {
  return css.replace(/\/\*[\s\S]*?\*\//g, "");
}

/**
 * 指定した at-rule のブロック(`@theme ... { ... }` 等)を中身ごと除く。波括弧の入れ子に対応。
 * 名前は `@theme` のように `@` 付きで渡す。`@theme inline` のような修飾付きも同じ名前で除かれる。
 */
export function stripAtRuleBlocks(css: string, atRules: readonly string[]): string {
  let out = "";
  let i = 0;
  while (i < css.length) {
    const rest = css.slice(i);
    const hit = atRules.find((rule) => rest.startsWith(rule) && !/[\w-]/.test(rest.charAt(rule.length)));
    if (!hit) {
      out += css[i];
      i += 1;
      continue;
    }
    const open = css.indexOf("{", i);
    const semi = css.indexOf(";", i);
    // ブロックを持たない形(`@import ...;` のような 1 文)はそのまま残す
    if (open === -1 || (semi !== -1 && semi < open)) {
      out += css[i];
      i += 1;
      continue;
    }
    let depth = 0;
    let j = open;
    for (; j < css.length; j += 1) {
      if (css[j] === "{") depth += 1;
      else if (css[j] === "}") {
        depth -= 1;
        if (depth === 0) break;
      }
    }
    i = j + 1;
  }
  return out;
}

/** 相対パス(./ か ../ で始まる)の @import 先だけを返す。パッケージ名(tailwindcss 等)は対象外 */
export function collectRelativeImports(css: string): string[] {
  const out: string[] = [];
  const re = /@import\s+(?:url\()?\s*["']([^"']+)["']\s*\)?[^;]*;/g;
  for (const m of stripComments(css).matchAll(re)) {
    const target = m[1];
    if (target.startsWith("./") || target.startsWith("../")) out.push(target);
  }
  return out;
}

/** 検査対象から外す at-rule。@theme は使われた変数しか出力されず、@utility は未使用なら削られる */
export const EXCLUDED_AT_RULES = ["@theme", "@utility"] as const;

/** 宣言位置にある CSS カスタムプロパティ名(`--x:` の `--x`)を重複なしで返す */
export function collectDefinedNames(css: string): string[] {
  const body = stripAtRuleBlocks(stripComments(css), EXCLUDED_AT_RULES);
  const names = new Set<string>();
  for (const m of body.matchAll(/(?:^|[{;\s])(--[A-Za-z0-9_-]+)\s*:/g)) {
    names.add(m[1]);
  }
  return [...names];
}

export type CssSource = {
  /** リポジトリルートからの相対パス */
  file: string;
  /** そのファイルが宣言するカスタムプロパティ名 */
  names: string[];
};

/**
 * entry から相対 @import を再帰的に辿り、ファイルごとの宣言名を集める(重複 import は 1 回)。
 * 読めないファイルはそのまま throw(import 先の欠落はソースの不備なので止める)。
 */
export function resolveImportGraph(entryAbs: string, repoRoot: string): CssSource[] {
  const seen = new Set<string>();
  const out: CssSource[] = [];
  const visit = (abs: string) => {
    if (seen.has(abs)) return;
    seen.add(abs);
    const css = readFileSync(abs, "utf8");
    out.push({ file: toRepoRelative(abs, repoRoot), names: collectDefinedNames(css) });
    for (const target of collectRelativeImports(css)) {
      visit(resolve(dirname(abs), target));
    }
  };
  visit(resolve(entryAbs));
  return out;
}

function toRepoRelative(abs: string, repoRoot: string): string {
  const root = resolve(repoRoot);
  return abs.startsWith(root) ? abs.slice(root.length).replace(/^[/\\]/, "").replace(/\\/g, "/") : abs;
}

/** dir 配下の *.css を再帰的に集める(dir が無ければ空) */
export function findCssFiles(dir: string): string[] {
  let st;
  try {
    st = statSync(dir);
  } catch {
    return [];
  }
  if (!st.isDirectory()) return [];
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...findCssFiles(p));
    else if (entry.isFile() && entry.name.endsWith(".css")) out.push(p);
  }
  return out.sort();
}

export type BuiltCssReport = {
  /** 出力に無い名前を持つファイル */
  missing: Array<{ file: string; names: string[] }>;
  /** 宣言はあるが、全てが他のファイルにもある名前 = 抜けても検出できないファイル */
  unverifiable: string[];
  /** 検査した名前の総数 */
  checked: number;
};

/** ソースの宣言名が出力 CSS(連結済み)に全て現れるかを判定する */
export function checkBuiltCss(sources: readonly CssSource[], builtCss: string): BuiltCssReport {
  const owners = new Map<string, number>();
  for (const s of sources) for (const n of s.names) owners.set(n, (owners.get(n) ?? 0) + 1);

  const missing: BuiltCssReport["missing"] = [];
  const unverifiable: string[] = [];
  let checked = 0;
  for (const s of sources) {
    if (s.names.length === 0) continue;
    const absent = s.names.filter((n) => !builtCss.includes(`${n}:`));
    checked += s.names.length;
    if (absent.length > 0) missing.push({ file: s.file, names: absent });
    else if (s.names.every((n) => (owners.get(n) ?? 0) > 1)) unverifiable.push(s.file);
  }
  return { missing, unverifiable, checked };
}
