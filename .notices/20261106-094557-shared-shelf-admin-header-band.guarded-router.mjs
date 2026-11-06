#!/usr/bin/env node
// .notices/20261106-094557-shared-shelf-admin-header-band.guarded-router.mjs
// next/navigation の useRouter を、未保存の編集の守り付きの router へ移す(指令 18・D11。fork の移し方でも使う)。リポのルートで走らせる。
// 使い方: node .notices/20261106-094557-shared-shelf-admin-header-band.guarded-router.mjs [--apply] [--json]
//   既定は dry-run(書き換える一覧だけ)。--apply で書き換える。何度走らせても同じ結果。手順: 下の「fork の手順」
//
// - src の .ts / .tsx の `import { useRouter } from "next/navigation"`(別名・ほかの名前と一緒でも)から useRouter だけを外し、
//   `import { useRouter } from "@/lib/unsavedGuard"`(同じ名前・同じ形)を足す。呼び出しの書き方はそのまま
// - 棚(src/components)は lib を読まない(D50): `import { useShelfRouter as useRouter } from "@/components/Navigation/NavigationPort"`
// - 触らない: 守りの lib の中(src/lib/unsavedGuard)・テスト・型だけの import
// lint import-boundaries/router-via-guard が残りを報告する。
//
// 仕組み: src/lib/unsavedGuard/README.md。lint は上流 error・fork warn、例外は守りの lib の中だけ
// fork の手順:
// 1. 上流のこの版(守りの lib の版)を /flux で取り込む(上流のファイルは取り込みで移る)
// 2. dry-run → --apply で fork のファイルを移す
// 3. pnpm typecheck → pnpm lint(router-via-guard の残りが 0)
// 4. 編集画面を AppForm で組んでいなければ、その画面で useUnsavedGuard(isDirty) を呼ぶ(AppForm は既定で守る。切るなら guardUnsaved={false})。
//    自作の守り(beforeunload・popstate の自前の処理)は外す

import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import ts from "typescript";

const SKIP_DIRS = new Set(["node_modules", ".next", ".git"]);
const GUARD_LIB = "src/lib/unsavedGuard/";
const SHELF = "src/components/";
export const GUARD_IMPORT = "@/lib/unsavedGuard";
export const SHELF_IMPORT = "@/components/Navigation/NavigationPort";

function listFiles(root) {
  const out = [];
  const walk = (rel) => {
    const abs = join(root, rel);
    if (!existsSync(abs)) return;
    for (const entry of readdirSync(abs, { withFileTypes: true })) {
      if (SKIP_DIRS.has(entry.name)) continue;
      const path = `${rel}/${entry.name}`;
      if (entry.isDirectory()) walk(path);
      else if (/\.tsx?$/.test(entry.name) && !/\.(test|spec|d)\.tsx?$/.test(entry.name)) out.push(path);
    }
  };
  walk("src");
  return out.sort();
}

/**
 * 1 ファイルの書き換え。書き換えが無ければ null
 * @param {string} path リポジトリ直下からの相対
 * @param {string} text
 * @returns {{ text: string, local: string } | null}
 */
export function rewriteRouterImport(path, text) {
  if (path.startsWith(GUARD_LIB)) return null;
  const source = ts.createSourceFile(path, text, ts.ScriptTarget.Latest, true, path.endsWith("x") ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  for (const statement of source.statements) {
    if (!ts.isImportDeclaration(statement) || !ts.isStringLiteral(statement.moduleSpecifier) || statement.moduleSpecifier.text !== "next/navigation") continue;
    const clause = statement.importClause;
    if (!clause || clause.isTypeOnly || !clause.namedBindings || !ts.isNamedImports(clause.namedBindings)) continue;
    const elements = clause.namedBindings.elements;
    const router = elements.find((el) => !el.isTypeOnly && (el.propertyName ?? el.name).text === "useRouter");
    if (!router) continue;
    const local = router.name.text;
    const rest = elements.filter((el) => el !== router);
    const shelf = path.startsWith(SHELF);
    const added = shelf
      ? `import { useShelfRouter as ${local} } from "${SHELF_IMPORT}";`
      : `import { ${local === "useRouter" ? "useRouter" : `useRouter as ${local}`} } from "${GUARD_IMPORT}";`;
    const kept = rest.length > 0 ? `import ${clause.name ? `${clause.name.text}, ` : ""}{ ${rest.map((el) => el.getText(source)).join(", ")} } from "next/navigation";\n` : "";
    const start = statement.getStart(source);
    const end = statement.getEnd();
    return { text: `${text.slice(0, start)}${kept}${added}${text.slice(end)}`, local };
  }
  return null;
}

/** リポ全体の計画 */
export function planGuardedRouter(root) {
  const changes = [];
  for (const path of listFiles(root)) {
    const text = readFileSync(join(root, path), "utf8");
    if (!text.includes("next/navigation")) continue;
    const rewritten = rewriteRouterImport(path, text);
    if (rewritten) changes.push({ path, text: rewritten.text, shelf: path.startsWith(SHELF) });
  }
  return { changes };
}

function main() {
  const args = process.argv.slice(2);
  const root = process.cwd();
  const apply = args.includes("--apply");
  const plan = planGuardedRouter(root);
  if (apply) for (const c of plan.changes) writeFileSync(join(root, c.path), c.text);
  if (args.includes("--json")) {
    console.log(JSON.stringify({ mode: apply ? "apply" : "dry-run", changes: plan.changes.map((c) => ({ path: c.path, shelf: c.shelf })) }, null, 2));
    return;
  }
  console.log(`[guarded-router] ${apply ? "apply" : "dry-run"}: ${plan.changes.length} ファイル`);
  for (const c of plan.changes) console.log(`  ${c.path} → ${c.shelf ? `${SHELF_IMPORT}(棚)` : GUARD_IMPORT}`);
  if (!apply && plan.changes.length > 0) console.log("--apply で書き換える(続けて pnpm lint の import-boundaries/router-via-guard で残りを確かめる)");
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main();
