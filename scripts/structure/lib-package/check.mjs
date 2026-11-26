// scripts/structure/lib-package/check.mjs
//
// pnpm check lib-package(段階 build・ship)。閉じたかの検査。package.json を持つ lib ごとに(closed.mjs の closedLibProblems):
//   1. tsconfig.json を package.json の宣言と比べる(無い・食い違う → 直す行を出す。この lib の型検査はしない)
//   2. その tsconfig.json で型検査する(宣言の外の lib・棚を読む → 落ちる)
//   3. sideEffects の宣言と副作用を照らす
//   4. 入口の中身: "." の先頭に "use client" が無いか、"./node" から React・Next を辿らないか(entries.mjs)
//   5. config.ts があるなら上書き src/config/lib/<名前>.config.ts があるか
//   6. 自前の合成(defineXxxConfig)が残っていないか
// package.json の形の問題(src/lib/libPackage の checkLibPackage。入口の名前 = exports の鍵が . ./server ./client ./node だけ、も
// ここ: entryName)がある lib は 1〜6 を飛ばし、閉じていない不備 1 つ(shape、形の問題を並べる)で落とす
// (宣言した lib が全部閉じているかの確かめはこの段階だけ: テストは今の repo を見ない)。
// 宣言の無い lib(package.json の無い src/lib/<名前>)は不備 undeclared で落とす(K6)。外から中を読む import は --list / --json で数えて見せるだけ(落とすのは pnpm lint の entry/only-entries)。
//
//   pnpm check lib-package                 不備の行 + 1 行のまとめ
//   pnpm check lib-package -- --list       lib ごとの表(外から中を読む import の数も)
//   pnpm check lib-package -- --json       同じものを JSON で(指令 27・クエスト向け)
// 動き(action。-- の後の最初の語。scripts/structure/routes の -- show と同じ形):
//   pnpm check lib-package -- jsdoc [--lib <名前>]... [--apply] [--json]  JS の lib の暗黙の any に推した型を JSDoc で書く(jsdoc.mjs)
//   pnpm check lib-package -- declare [<名前>]... [--apply] [--json]  自分の節の宣言の無い lib に package.json と tsconfig.json を書く(declare.mjs)
//   pnpm check lib-package -- help          使い方
// exit 0 = 不備 0(宣言の無い lib 0 を含む)/ 1 = 不備あり / 2 = 引数の誤り(動きの exit はその動きの物)

import path from "node:path";
import { fileURLToPath } from "node:url";

import { listDeclaredLibs, listLibs, readLibPackage } from "../../../src/lib/libPackage/node.mjs";
import { closedLibProblems, libStates, undeclaredProblem } from "./closed.mjs";

/** @returns {{ checked: string[], skipped: string[], undeclared: string[], problems: { lib: string, code: string, message: string }[] }} */
export function checkLibs(root) {
  const checked = [];
  const skipped = [];
  const problems = [];
  const declared = listDeclaredLibs(root);
  for (const lib of declared) {
    const shape = readLibPackage(root, lib).problems;
    if (shape.length > 0) {
      skipped.push(lib);
      problems.push({
        lib,
        code: "shape",
        message: `${lib}: 宣言した lib が閉じていません: package.json の形に問題がある(${shape.map((p) => `${p.code}: ${p.message}`).join(" | ")})`,
      });
      continue;
    }
    checked.push(lib);
    problems.push(...closedLibProblems(root, lib));
  }
  const undeclared = listLibs(root).filter((lib) => !declared.includes(lib));
  problems.push(...undeclared.map(undeclaredProblem));
  return { checked, skipped, undeclared, problems };
}

const STATE_ORDER = { gaps: 0, skipped: 1, closed: 2, undeclared: 3 };

/** 表とまとめ(--list / --json の中身) */
export function libReport(root) {
  const rows = libStates(root, { withInner: true }).sort(
    (a, b) =>
      STATE_ORDER[a.state] - STATE_ORDER[b.state] ||
      (b.innerImports ?? 0) - (a.innerImports ?? 0) ||
      a.lib.localeCompare(b.lib),
  );
  const count = (state) => rows.filter((r) => r.state === state).length;
  const summary = {
    libs: rows.length,
    closed: count("closed"),
    gaps: count("gaps"),
    skipped: count("skipped"),
    undeclared: count("undeclared"),
    problems: rows.reduce((n, r) => n + r.problems.length, 0),
    innerImportsDeclared: rows.filter((r) => r.state !== "undeclared").reduce((n, r) => n + r.innerImports, 0),
    innerImportsUndeclared: rows.filter((r) => r.state === "undeclared").reduce((n, r) => n + r.innerImports, 0),
  };
  return { rows, summary };
}

function formatTable({ rows, summary }) {
  const head = ["state", "lib", "declared", "inner", "problems", "config", "merge"];
  const body = rows.map((r) => [
    r.state,
    r.lib,
    r.declared,
    String(r.innerImports),
    String(r.problems.length),
    r.config,
    r.mergeHelpers.join(",") || "-",
  ]);
  const widths = head.map((h, i) => Math.max(h.length, ...body.map((row) => row[i].length)));
  const line = (cells) =>
    cells
      .map((c, i) => c.padEnd(widths[i]))
      .join("  ")
      .trimEnd();
  const out = [line(head), ...body.map(line)];
  for (const r of rows) for (const p of r.problems) out.push(`  ${p.message}`);
  out.push(
    `閉じた lib ${summary.closed}・不備のある lib ${summary.gaps}(不備 ${summary.problems})・形で飛ばした ${summary.skipped}・宣言のない lib ${summary.undeclared}` +
      `(外から中を読む import: 宣言した lib ${summary.innerImportsDeclared}・宣言のない lib ${summary.innerImportsUndeclared})`,
  );
  return out.join("\n");
}

export const USAGE = [
  "pnpm check lib-package                         閉じたかの検査(段階 build・ship)",
  "pnpm check lib-package -- --list | --json      lib ごとの状態の表 / JSON",
  "pnpm check lib-package -- jsdoc [--lib <名前>]... [--apply] [--json]  JS の lib の暗黙の any に推した型を JSDoc で書く(既定 dry-run、{any} の所を一覧に出す)",
  "pnpm check lib-package -- declare [<名前>]... [--apply] [--json]  自分の節(src/lib/CATALOG.md)の宣言の無い lib に package.json と tsconfig.json を書く(既定 dry-run、決めきれない所を一覧に出す。祖先の lib は拒む)",
].join("\n");

// 終了コードを返す(process.exit で抜けると、パイプ先へ書き切る前に出力が切れる)
async function main() {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
  const argv = process.argv.slice(2);
  const args = argv.filter((a) => a !== "--");
  const action = args[0] && !args[0].startsWith("-") ? args[0] : null;
  if (action === "help") {
    console.log(USAGE);
    return 0;
  }
  if (action === "jsdoc") {
    const { runJsdoc } = await import("./jsdoc.mjs");
    return runJsdoc(root, args.slice(1));
  }
  if (action === "declare") {
    const { runDeclare } = await import("./declare.mjs");
    return runDeclare(root, args.slice(1));
  }
  const unknown = args.filter((a) => a !== "--list" && a !== "--json");
  if (unknown.length > 0) {
    console.error(`lib-package: 知らない引数 ${unknown.join(" ")}\n${USAGE}`);
    return 2;
  }
  if (args.includes("--json") || args.includes("--list")) {
    const report = libReport(root);
    console.log(args.includes("--json") ? JSON.stringify(report, null, 2) : formatTable(report));
    return report.summary.problems > 0 || report.summary.skipped > 0 ? 1 : 0; // undeclared の行も不備 1 つを持つ
  }
  const { checked, skipped, undeclared, problems } = checkLibs(root);
  for (const p of problems) console.log(`lib-package: ${p.message}`);
  console.log(
    `lib-package: package.json を持つ lib ${checked.length + skipped.length}(検査 ${checked.length}・飛ばした ${skipped.length})・問題 ${problems.length}・宣言のない lib ${undeclared.length}(不備に入る。一覧: pnpm check lib-package -- --list)`,
  );
  return problems.length > 0 ? 1 : 0;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url))
  process.exitCode = await main();
