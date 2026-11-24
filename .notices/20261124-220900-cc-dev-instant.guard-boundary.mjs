#!/usr/bin/env node
// .notices/20261124-220900-cc-dev-instant.guard-boundary.mjs
// 範囲の守りを境界(Guard)の内側で確かめる形への移行(D76)。fork のリポのルートで走らせる。
// 使い方: node .notices/20261124-220900-cc-dev-instant.guard-boundary.mjs [--apply] [--json]
//   既定は dry-run(書き換える物と止める物の一覧だけ)。--apply で書く。何度走らせても同じ結果(2 回目は 0 件)
//
// 書き換える物(src/app の木、`_` で始まるフォルダは見ない):
// 1. guard.ts の書き出し `export const { guard, createLoader, guardMetadata, extend } =` → `{ Guard, createLoader, guardMetadata, extend }`
// 2. public でない guard.ts の隣の layout.tsx で、`await guard();` の後に return だけを持つ形
//    (`export default async function X({ children }) { await guard(); return <…>; }`)→ async を外し、return の JSX を
//    `<Guard fallback={<Loading />}>…</Guard>` で包み、`./guard` の import の guard を Guard に、`import Loading from "./loading"` を足す。
//    隣に loading.tsx が無ければ文字なしの ScreenLoader の loading.tsx を作る
// 3. 守りの範囲(最寄りの guard.ts が public でない)で、2 つのページの間の遷移に共有される段(src/lib/screens の
//    sharedNavigationSegments)に loading.tsx が無ければ作る
// 作る loading.tsx の見た目: admin・debug の下は bg-muted・text-primary、ほかは bg-transparent・text-background(上流の範囲と同じ)。
//   見た目を自分の範囲に合わせるなら、作った後に手で直す(文字は持たせない: 殻に入る)
//
// 止める物(書き換えず一覧に出す。直し方の 1 行付き): 範囲の layout が `await guard()` の前後に別の文を持つ・guard を別名で読む・
//   `Loading` の名前が既にある・guard.ts の書き出しが上の形でない。手で `<Guard fallback={<その範囲の loading />}>` の形にする
//   (core/screens.md range_layout、src/lib/screens/README.md「範囲(guard.ts)」)
//
// fork の手順: この notice の区切りを /flux で取り込む → dry-run → --apply → pnpm generate routes(地図の検査が残りを名指す)

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import {
  discoverRoutes,
  findNearestGuard,
  listAppFiles,
  parseGuardFile,
  sharedNavigationSegments,
} from "../src/lib/screens/node.mjs";

const OLD_EXPORT = /export\s+const\s*\{\s*guard\s*,\s*createLoader\s*,\s*guardMetadata\s*,\s*extend\s*\}\s*=/;
const NEW_EXPORT = "export const { Guard, createLoader, guardMetadata, extend } =";

/** guard.ts の書き出しを新しい形に。新しい形なら null(変更なし) */
export function rewriteGuardFile(source) {
  if (!OLD_EXPORT.test(source)) return null;
  return source.replace(OLD_EXPORT, NEW_EXPORT);
}

const LAYOUT_BODY =
  /export\s+default\s+async\s+function\s+([\w$]+)\s*\(([\s\S]*?)\)\s*\{\s*await\s+guard\s*\(\s*\)\s*;\s*return\s+([\s\S]*?);\s*\}\s*$/;

/** 字面の JSX の外側の括弧を外して前後の空白を落とす */
function unwrap(expr) {
  let e = expr.trim();
  if (e.startsWith("(") && e.endsWith(")")) e = e.slice(1, -1).trim();
  return e;
}

/** 行を揃えて n 個の空白で字下げする */
function indent(text, n) {
  const lines = text.split("\n");
  const rest = lines.slice(1).filter((l) => l.trim());
  const common = rest.length ? Math.min(...rest.map((l) => l.match(/^ */)[0].length)) : 0;
  const pad = " ".repeat(n);
  return lines.map((l, i) => (i === 0 ? pad + l.trim() : l.trim() ? pad + l.slice(common) : "")).join("\n");
}

/**
 * 範囲の layout を Guard の形に。書き換えたら { text }、もう新しい形なら null、書き換えられなければ { stop }
 * @param {string} source
 */
export function rewriteRangeLayout(source) {
  if (!/\bawait\s+guard\s*\(\s*\)/.test(source)) return null;
  const imp = source.match(/import\s*\{([^}]*)\}\s*from\s*["']\.\/guard["']\s*;?/);
  const names = imp ? imp[1].split(",").map((n) => n.trim()).filter(Boolean) : [];
  if (!imp || !names.includes("guard")) return { stop: "guard を ./guard から別名なしで読んでいない" };
  if (/\bLoading\b/.test(source)) return { stop: "Loading の名前が既にある" };
  const body = source.match(LAYOUT_BODY);
  if (!body) return { stop: "layout の本体が `await guard();` の後に return だけ、の形でない" };
  const [whole, name, params, expr] = body;
  const inner = unwrap(expr);
  const wrapped = /^(<>\s*\{children\}\s*<\/>|children)$/.test(inner)
    ? "  return <Guard fallback={<Loading />}>{children}</Guard>;"
    : `  return (\n    <Guard fallback={<Loading />}>\n${indent(inner, 6)}\n    </Guard>\n  );`;
  const fn = `export default function ${name}(${params}) {\n${wrapped}\n}\n`;
  const newImport = `import { ${names.map((n) => (n === "guard" ? "Guard" : n)).join(", ")} } from "./guard";\nimport Loading from "./loading";`;
  const text = source.replace(whole, fn).replace(imp[0], newImport);
  return { text };
}

/** 作る loading.tsx の中身 */
export function loadingSource(dir) {
  const admin = /^src\/app\/(admin|debug)(\/|$)/.test(dir);
  return `// ${dir}/loading.tsx
//
// 守りの範囲の境界の fallback(範囲の Guard と、遷移に共有される段の loader の待ち、D76)。文字を持たない(殻に入るため)

import { ScreenLoader } from "@/components/Overlays/Loading";

export default function Loading() {
  return (
    <ScreenLoader
      mode="fullscreen"
      className="${admin ? "bg-muted" : "bg-transparent"}"
      spinnerClassName="h-12 w-12 ${admin ? "text-primary" : "text-background"}"
    />
  );
}
`;
}

/**
 * 木を読んで変更の一覧を作る(書かない)
 * @param {string} root
 * @returns {{ changes: Array<{ file: string, kind: string, content: string }>, stops: Array<{ file: string, why: string }> }}
 */
export function plan(root) {
  const files = listAppFiles(root);
  const fileSet = new Set(files);
  const read = (p) => readFileSync(join(root, p), "utf8");
  const changes = [];
  const stops = [];
  const nonPublic = (guardFile) => {
    const { policy } = parseGuardFile(read(guardFile));
    return Boolean(policy && policy.access !== "public");
  };
  const addLoading = (dir) => {
    const file = `${dir}/loading.tsx`;
    if (fileSet.has(file)) return;
    fileSet.add(file);
    changes.push({ file, kind: "loading", content: loadingSource(dir) });
  };
  for (const file of files.filter((f) => f.endsWith("/guard.ts"))) {
    const next = rewriteGuardFile(read(file));
    if (next !== null) changes.push({ file, kind: "guard", content: next });
    else if (!/export\s+const\s*\{\s*Guard\s*,/.test(read(file))) {
      stops.push({ file, why: "guard.ts の書き出しが `export const { guard, createLoader, guardMetadata, extend } =` の形でない(手で { Guard, createLoader, guardMetadata, extend } に)" });
    }
  }
  for (const file of files.filter((f) => /\/layout\.tsx$/.test(f))) {
    const dir = file.slice(0, file.lastIndexOf("/"));
    const guardFile = `${dir}/guard.ts`;
    if (!fileSet.has(guardFile) || !nonPublic(guardFile)) continue;
    const result = rewriteRangeLayout(read(file));
    if (result === null) continue;
    if ("stop" in result) {
      stops.push({ file, why: `${result.stop}(手で中身を <Guard fallback={<その範囲の loading />}> で包み、頭の await guard() を消す)` });
      continue;
    }
    changes.push({ file, kind: "layout", content: result.text });
    addLoading(dir);
  }
  const { routes } = discoverRoutes(files);
  for (const dir of sharedNavigationSegments(routes.map((r) => r.dir))) {
    if (!dir.startsWith("src/app/")) continue;
    const guardFile = findNearestGuard(dir, fileSet);
    if (guardFile && nonPublic(guardFile)) addLoading(dir);
  }
  return { changes, stops };
}

/** @param {string} root @param {{ apply?: boolean }} [options] */
export function run(root, { apply = false } = {}) {
  const result = plan(root);
  if (apply) for (const c of result.changes) writeFileSync(join(root, c.file), c.content);
  return result;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const apply = process.argv.includes("--apply");
  const root = process.cwd();
  if (!existsSync(join(root, "src/app"))) {
    console.error("src/app が無い: リポのルートで走らせる");
    process.exit(2);
  }
  const { changes, stops } = run(root, { apply });
  if (process.argv.includes("--json")) {
    console.log(JSON.stringify({ apply, changes: changes.map(({ file, kind }) => ({ file, kind })), stops }, null, 1));
  } else {
    for (const c of changes) console.log(`${apply ? "書いた" : "書く"} ${c.kind} ${c.file}`);
    for (const s of stops) console.log(`止める ${s.file}: ${s.why}`);
    console.log(`guard-boundary: ${apply ? "書いた" : "書く(dry-run、書くのは --apply)"} ${changes.length} 件・止める ${stops.length} 件`);
  }
  process.exit(stops.length > 0 ? 1 : 0);
}
