// scripts/extensions/intake.mjs
// 受け口の一覧(src/lib/forkOwnership/intake.txt)の生成区画の行を、拡張点の宣言と 1 行スイッチから組み立てる
// (pnpm extensions:generate が書き、extensions:check がずれを止める)。区画の印と差し替えは src/lib/forkOwnership/intake.mjs。
// 行の kind は add(fork が足すのは可、基準にあるファイルの書き換えは違反)。書式: ./README.md

import { existsSync, readFileSync } from "node:fs";
import { join, posix } from "node:path";

import { INTAKE_FILE, replaceIntakeBlock } from "../../src/lib/forkOwnership/intake.mjs";

/** 宣言に依らない受け口(route の隣の丸ごと置き換え・scripts の 1 項目 1 ファイルの受け口) */
const FIXED_ROWS = [
  "add src/app/**/_layout/**/*.replace.{ts,tsx}  # 枠の部品の丸ごと置き換え(_layout の隣の <名前>.replace)",
  "add src/app/**/_screen/**/*.replace.{ts,tsx}  # Screen の丸ごと置き換え(_screen の隣の <名前>.replace)",
  "add scripts/tasks/*.ts  # ワンショット・任意タスク(scripts/tasks/README.md)",
];

/**
 * 生成区画の行
 * @param {{ owner: string, name: string, declaredIn: string, spec: object }[]} points 全拡張点(writer の点は受け口を持たない)
 * @param {{ path: string }[]} switches 1 行スイッチ(<dir>/<名前>.ts(x))
 * @returns {string[]}
 */
export function intakeRows(points, switches) {
  const byDir = new Map();
  for (const point of points.filter((p) => !p.spec.writer)) {
    const dir = posix.normalize(posix.join(point.owner, point.spec.dir));
    const entry = byDir.get(dir) ?? { names: [], files: new Set(), plain: false };
    entry.names.push(point.name);
    if (point.spec.files) entry.files.add(point.spec.files.slice("*/".length));
    else entry.plain = true;
    byDir.set(dir, entry);
  }
  const rows = ["# pnpm extensions:generate が拡張点の宣言(extensionPoints.ts)と 1 行スイッチから書く。手で編集しない(ずれは extensions:check が止める)"];
  for (const [dir, entry] of [...byDir.entries()].sort(([a], [b]) => (a < b ? -1 : 1))) {
    const label = `受け口 ${entry.names.join("・")}`;
    if (entry.plain) {
      rows.push(`add ${dir}/*.{ts,tsx}  # ${label}`);
      rows.push(`add ${dir}/*/**  # ${label}(フォルダ形)`);
    }
    for (const file of [...entry.files].sort()) rows.push(`add ${dir}/*/${file}  # ${label}`);
  }
  for (const { path } of [...switches].sort((a, b) => (a.path < b.path ? -1 : 1))) {
    const stem = path.replace(/\.tsx?$/, "");
    rows.push(`add ${stem}.replace.{ts,tsx}  # 1 行スイッチ ${path} の丸ごと置き換え`);
  }
  rows.push(...FIXED_ROWS);
  return rows;
}

/**
 * intake.txt の生成区画を作り直したテキスト(intake.txt が無いリポ = テストの fixture では null)
 * @returns {{ path: string, content: string } | { problem: string } | null}
 */
export function planIntake(repoRoot, points, switches) {
  const abs = join(repoRoot, INTAKE_FILE);
  if (!existsSync(abs)) return null;
  const replaced = replaceIntakeBlock(readFileSync(abs, "utf8"), intakeRows(points, switches));
  return "problem" in replaced ? { problem: `${INTAKE_FILE}: ${replaced.problem}` } : { path: INTAKE_FILE, content: replaced.text };
}
