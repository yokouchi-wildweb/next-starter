// scripts/structure/extensions/intake.mjs
// 受け口の一覧(src/lib/forkOwnership/intake.txt)の生成区画の行を、拡張点の宣言と 1 行スイッチから組み立てる
// (pnpm generate extensions が書き、pnpm check extensions がずれを止める)。区画の印と差し替えは src/lib/forkOwnership/intake.mjs。
// 行の kind: 受け口の項目・丸ごと置き換え・足してよい対象(addable)= add(fork が足すのは可、基準にあるファイルの書き換えは違反)、
// 1 行スイッチの素の名前・上書きの対象の点の <対象>.override.ts = edit(書き換え可。多段で下の Tier が親の物を書き換える)。書式: ./README.md

import { existsSync, readFileSync } from "node:fs";
import { join, posix } from "node:path";

import { isListPoint } from "../../../src/lib/districtMap/declarations.mjs";
import { INTAKE_FILE, replaceIntakeBlock } from "../../../src/lib/forkOwnership/intake.mjs";

/** 宣言に依らない受け口(route の隣の丸ごと置き換え・枠の宣言)。ドメインのタスクは fork 自身のドメインに置くので受け口の行は無い */
const FIXED_ROWS = [
  "add src/app/**/_layout/**/*.replace.{ts,tsx}  # 枠の部品の丸ごと置き換え(_layout の隣の <名前>.replace)",
  "add src/app/**/_screen/**/*.replace.{ts,tsx}  # Screen の丸ごと置き換え(_screen の隣の <名前>.replace)",
  "add src/app/**/frame.ts  # 枠の宣言(上流のルートの隣でも自分のルートでも。ルートを作ったリポの既定は frame.default.ts、src/app/_layout/frame/README.md)",
];

/** 対象の glob → 隣の上書きの glob(最後の拡張子を .override.ts に: task.ts → task.override.ts、*.role.json → *.role.override.ts) */
export const overrideGlobOf = (glob) => glob.replace(/\.[A-Za-z]+$/, ".override.ts");

/**
 * 生成区画の行
 * @param {{ owner: string, name: string, declaredIn: string, spec: object }[]} points 全拡張点(writer の点・overrides の点は受け口を持たない)
 * @param {{ path: string }[]} switches 1 行スイッチ(<dir>/<名前>.ts(x))
 * @returns {string[]}
 */
export function intakeRows(points, switches) {
  const byDir = new Map();
  for (const point of points.filter((p) => isListPoint(p.spec))) {
    const dir = posix.normalize(posix.join(point.owner, point.spec.dir));
    const entry = byDir.get(dir) ?? { names: [], files: new Set(), plain: false };
    entry.names.push(point.name);
    if (point.spec.files) entry.files.add(point.spec.files.slice("*/".length));
    else entry.plain = true;
    byDir.set(dir, entry);
  }
  const rows = ["# pnpm generate extensions が拡張点の宣言(extensionPoints.ts)と 1 行スイッチから書く。手で編集しない(ずれは pnpm check extensions が止める)"];
  for (const [dir, entry] of [...byDir.entries()].sort(([a], [b]) => (a < b ? -1 : 1))) {
    const label = `受け口 ${entry.names.join("・")}`;
    if (entry.plain) {
      rows.push(`add ${dir}/*.{ts,tsx}  # ${label}`);
      rows.push(`add ${dir}/*/**  # ${label}(フォルダ形)`);
    }
    for (const file of [...entry.files].sort()) rows.push(`add ${dir}/*/${file}  # ${label}`);
  }
  const sortedSwitches = [...switches].sort((a, b) => (a.path < b.path ? -1 : 1));
  for (const { path } of sortedSwitches) rows.push(`edit ${path}  # 1 行スイッチ(呼び手が import する素の名前。向け先を ./<名前>.replace に替える)`);
  for (const { path } of sortedSwitches) {
    const stem = path.replace(/\.tsx?$/, "");
    rows.push(`add ${stem}.replace.{ts,tsx}  # 1 行スイッチ ${path} の丸ごと置き換え`);
  }
  // 上書きの対象の点(overrides の glob): 隣の <対象>.override.ts は edit、addable の点は対象そのものを足すのが add
  for (const point of [...points].filter((p) => p.spec.overrides !== undefined).sort((a, b) => (a.spec.overrides < b.spec.overrides ? -1 : 1))) {
    const glob = point.spec.overrides;
    rows.push(`edit ${overrideGlobOf(glob)}  # 上書き ${point.name}(${point.spec.overrideOf.join("・")})`);
    if (point.spec.addable) rows.push(`add ${glob}  # fork が足す ${point.name}(上流の物の変更は隣の .override.ts)`);
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
