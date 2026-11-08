// scripts/structure/lib-package/check.mjs
//
// pnpm check lib-package(門 build・ship)。閉じたかの検査。package.json を持つ lib ごとに(closed.mjs の closedLibProblems):
//   1. tsconfig.json を package.json の宣言と比べる(無い・食い違う → 直す行を出す。この lib の型検査はしない)
//   2. その tsconfig.json で型検査する(宣言の外の lib・棚を読む → 落ちる)
//   3. sideEffects の宣言と副作用を照らす
//   4. config.ts があるなら上書き src/config/lib/<名前>.config.ts があるか
//   5. 自前の合成(defineXxxConfig)が残っていないか
// package.json の形の問題(src/lib/libPackage の checkLibPackage)がある lib は飛ばして名前を出す(形は lint と形の検査が見る)。
// 宣言の無い lib は数えるだけ(落とさない)。外から中を読む import は --list / --json で数えて見せるだけ(落とすのは pnpm lint の lib-entry)。
//
//   pnpm check lib-package                 不備の行 + 1 行のまとめ
//   pnpm check lib-package -- --list       lib ごとの表(外から中を読む import の数も)
//   pnpm check lib-package -- --json       同じものを JSON で(指令 27・クエスト向け)
// 動き(action。-- の後の最初の語。scripts/structure/routes の -- show と同じ形):
//   pnpm check lib-package -- codemod [引数]  閉じた lib の中を読む import を入口へ書き換える(codemod.mjs。-- codemod --help)
//   pnpm check lib-package -- moved --base <rev> [--head <rev>] [--json]  notice の moved: と imports: の表(moved.mjs)
//   pnpm check lib-package -- help          使い方
// exit 0 = 宣言した lib に不備 0(package.json を持つ lib 0 も含む)/ 1 = 不備あり / 2 = 引数の誤り(動きの exit はその動きの物)

import path from "node:path";
import { fileURLToPath } from "node:url";

import { listDeclaredLibs, listLibs, readLibPackage } from "../../../src/lib/libPackage/index.mjs";
import { closedLibProblems, libStates } from "./closed.mjs";

/** @returns {{ checked: string[], skipped: string[], undeclared: string[], problems: { lib: string, code: string, message: string }[] }} */
export function checkLibs(root) {
  const checked = [];
  const skipped = [];
  const problems = [];
  const declared = listDeclaredLibs(root);
  for (const lib of declared) {
    if (readLibPackage(root, lib).problems.length > 0) {
      skipped.push(lib);
      continue;
    }
    checked.push(lib);
    problems.push(...closedLibProblems(root, lib));
  }
  const undeclared = listLibs(root).filter((lib) => !declared.includes(lib));
  return { checked, skipped, undeclared, problems };
}

const STATE_ORDER = { gaps: 0, skipped: 1, closed: 2, undeclared: 3 };

/** 表とまとめ(--list / --json の中身) */
export function libReport(root) {
  const rows = libStates(root, { withInner: true }).sort(
    (a, b) => STATE_ORDER[a.state] - STATE_ORDER[b.state] || (b.innerImports ?? 0) - (a.innerImports ?? 0) || a.lib.localeCompare(b.lib),
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
  const body = rows.map((r) => [r.state, r.lib, r.declared, String(r.innerImports), String(r.problems.length), r.config, r.mergeHelpers.join(",") || "-"]);
  const widths = head.map((h, i) => Math.max(h.length, ...body.map((row) => row[i].length)));
  const line = (cells) => cells.map((c, i) => c.padEnd(widths[i])).join("  ").trimEnd();
  const out = [line(head), ...body.map(line)];
  for (const r of rows) for (const p of r.problems) out.push(`  ${p.message}`);
  out.push(
    `閉じた lib ${summary.closed}・不備のある lib ${summary.gaps}(不備 ${summary.problems})・形で飛ばした ${summary.skipped}・宣言のない lib ${summary.undeclared}` +
      `(外から中を読む import: 宣言した lib ${summary.innerImportsDeclared}・宣言のない lib ${summary.innerImportsUndeclared})`,
  );
  return out.join("\n");
}

export const USAGE = [
  "pnpm check lib-package                         閉じたかの検査(門 build・ship)",
  "pnpm check lib-package -- --list | --json      lib ごとの状態の表 / JSON",
  "pnpm check lib-package -- codemod [引数]        閉じた lib の中を読む import を入口へ書き換える(既定 dry-run。-- codemod --help)",
  "pnpm check lib-package -- moved --base <rev> [--head <rev>] [--json]  notice の moved:(ファイル)と imports:(指定子)の表",
].join("\n");

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
  const argv = process.argv.slice(2);
  const args = argv.filter((a) => a !== "--");
  const action = args[0] && !args[0].startsWith("-") ? args[0] : null;
  if (action === "help") {
    console.log(USAGE);
    process.exit(0);
  }
  if (action === "codemod") {
    const { runCodemod } = await import("./codemod.mjs");
    process.exit(await runCodemod(root, args.slice(1)));
  }
  if (action === "moved") {
    const { runMoved } = await import("./moved.mjs");
    process.exit(runMoved(root, args.slice(1)));
  }
  const unknown = args.filter((a) => a !== "--list" && a !== "--json");
  if (unknown.length > 0) {
    console.error(`lib-package: 知らない引数 ${unknown.join(" ")}\n${USAGE}`);
    process.exit(2);
  }
  if (args.includes("--json") || args.includes("--list")) {
    const report = libReport(root);
    console.log(args.includes("--json") ? JSON.stringify(report, null, 2) : formatTable(report));
    process.exit(report.summary.problems > 0 ? 1 : 0);
  }
  const { checked, skipped, undeclared, problems } = checkLibs(root);
  for (const lib of skipped) console.log(`lib-package: ${lib}: package.json の形に問題があるので飛ばした(pnpm lint / src/lib/libPackage の形の検査で直す)`);
  for (const p of problems) console.log(`lib-package: ${p.message}`);
  console.log(
    `lib-package: package.json を持つ lib ${checked.length + skipped.length}(検査 ${checked.length}・飛ばした ${skipped.length})・問題 ${problems.length}・宣言のない lib ${undeclared.length}(数えるだけ。一覧: pnpm check lib-package -- --list)`,
  );
  process.exit(problems.length > 0 ? 1 : 0);
}
