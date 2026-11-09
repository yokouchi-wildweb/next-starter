// scripts/structure/extensions/intake.mjs
// 受け口の一覧(src/lib/forkOwnership/intake.txt)の生成区画の行を、拡張点の宣言と 1 行スイッチから組み立てる
// (pnpm generate extensions が書き、pnpm check extensions がずれを止める)。区画の印と差し替えは src/lib/forkOwnership/intake.mjs。
// 行の kind: 受け口の項目・丸ごと置き換え・足してよい対象(addable)= add(fork が足すのは可、基準にあるファイルの書き換えは違反)、
// 1 行スイッチの素の名前・上書きの対象の点の <対象>.override.ts = edit(書き換え可。多段で下の Tier が親の物を書き換える)。書式: ./README.md

import { existsSync, readFileSync } from "node:fs";
import { join, posix } from "node:path";

import { loadGates, scanTargets } from "../../runner/gates/scan.mjs";
import { parseSwitchLayout } from "../../../src/lib/screens/checks.mjs";
import { APP_DIR, discoverRoutes, listAppFiles } from "../../../src/lib/screens/routeTree.mjs";

import { isListPoint } from "../../../src/lib/districtMap/declarations.mjs";
import { INTAKE_FILE, replaceIntakeBlock } from "../../../src/lib/forkOwnership/intake.mjs";

/** 宣言に依らない受け口(route の隣の丸ごと置き換え・枠の宣言)。ドメインのタスクは fork 自身のドメインに置くので受け口の行は無い */
const FIXED_ROWS = [
  "add src/app/**/_layout/**/*.replace.{ts,tsx}  # 枠の部品の丸ごと置き換え(_layout の隣の <名前>.replace)",
  "add src/app/**/_screen/**/*.replace.{ts,tsx}  # Screen の丸ごと置き換え(_screen の隣の <名前>.replace)",
  "add src/app/**/frame.override.ts  # 枠の宣言(下のリポ。相手 = 上流のルート。ルートを作ったリポの宣言は frame.ts、src/app/_layout/frame/README.md)",
];

/** 実在のパスを、そのパスだけに当たる glob にする(node:path の matchesGlob。[slug] などの字の組・* ? は [x] で包む。\ の逃がしは効かない) */
export const literalGlob = (path) => path.replace(/[[\]*?]/g, (ch) => `[${ch}]`);

/** 対象の glob → 隣の上書きの glob(名前の決まりの元 src/lib/districtMap/extensionNames.mjs) */
export { overrideGlobOf } from "../../../src/lib/districtMap/extensionNames.mjs";
import { overrideGlobOf } from "../../../src/lib/districtMap/extensionNames.mjs";

/**
 * 生成区画の行。並びは効く種類を決める(最後に当たった行が効く): 置き場 → 画面 → 受け口 → 1 行スイッチ → 上書き → route の隣 → 生成器の region → 生成物
 * @param {{ owner: string, name: string, declaredIn: string, spec: object }[]} points 全拡張点(writer の点・overrides の点・placement の点は受け口を持たない)
 * @param {{ path: string }[]} switches 1 行スイッチ(<dir>/<名前>.ts(x))
 * @param {{ pages?: string[], frameSwitches?: string[], generators?: { name: string, outputs?: string[], regions?: string[] }[] }} [screensAndGenerators]
 *   pages = ルートの page.tsx(型 1、ルートの地図と同じ見つけ方)/ frameSwitches = 枠の 1 行スイッチの layout.tsx / generators = gate.json の outputs・regions
 * @returns {string[]}
 */
export function intakeRows(points, switches, { pages = [], frameSwitches = [], generators = [] } = {}) {
  const byDir = new Map();
  for (const point of points.filter((p) => isListPoint(p.spec))) {
    const dir = posix.normalize(posix.join(point.owner, point.spec.dir));
    const entry = byDir.get(dir) ?? { names: [], files: new Set(), plain: false };
    entry.names.push(point.name);
    if (point.spec.files) entry.files.add(point.spec.files.slice("*/".length));
    else entry.plain = true;
    byDir.set(dir, entry);
  }
  const rows = ["# pnpm generate extensions が拡張点の宣言(extensionPoints.ts)・ルート・1 行スイッチ・生成器の gate.json から書く。手で編集しない(ずれは pnpm check extensions が止める)"];
  // 置き場の点(placement): fork が書いてよい場所とその書き方
  for (const point of points.filter((p) => p.spec.placement !== undefined)) {
    rows.push(`${point.spec.kind} ${point.spec.placement}  # 置き場 ${point.name}(${point.declaredIn})`);
  }
  // 画面(型 1): ルートの page.tsx と枠の layout.tsx の 1 行スイッチ(向け先を _components/ に替える)
  for (const page of [...pages].sort()) rows.push(`edit ${literalGlob(page)}  # 画面の 1 行スイッチ`);
  for (const layout of [...frameSwitches].sort()) rows.push(`edit ${literalGlob(layout)}  # 枠の 1 行スイッチ`);
  for (const [dir, entry] of [...byDir.entries()].sort(([a], [b]) => (a < b ? -1 : 1))) {
    const label = `受け口 ${entry.names.join("・")}`;
    if (entry.plain) {
      rows.push(`add ${dir}/*.{ts,tsx}  # ${label}`);
      rows.push(`add ${dir}/*/**  # ${label}(フォルダ形)`);
    }
    for (const file of [...entry.files].sort()) rows.push(`add ${dir}/*/${file}  # ${label}`);
  }
  const sortedSwitches = [...switches].sort((a, b) => (a.path < b.path ? -1 : 1));
  for (const { path } of sortedSwitches) rows.push(`edit ${literalGlob(path)}  # 1 行スイッチ(呼び手が import する素の名前。向け先を ./<名前>.replace に替える)`);
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
  // 生成器(gate.json): region = 書き直しても fork の区画を残すファイル、generated = 丸ごと書くファイル(generated を最後に: 同じファイルなら生成物が効く)
  for (const g of generators) for (const glob of g.regions ?? []) rows.push(`region ${glob}  # 生成器 ${g.name} の fork の区画`);
  for (const g of generators) for (const glob of g.outputs ?? []) rows.push(`generated ${glob}  # 生成器 ${g.name} の出力`);
  return rows;
}

/** ルートの page.tsx と枠の 1 行スイッチの layout.tsx(src/app が無い fixture は空) */
function readScreens(repoRoot) {
  if (!existsSync(join(repoRoot, APP_DIR))) return { pages: [], frameSwitches: [] };
  const { routes } = discoverRoutes(listAppFiles(repoRoot));
  const pages = [...new Set(routes.map((r) => r.page))];
  const layouts = [...new Set(routes.flatMap((r) => r.layouts))];
  const frameSwitches = layouts.filter((path) => parseSwitchLayout(readFileSync(join(repoRoot, path), "utf8")).target !== null);
  return { pages, frameSwitches };
}

/** gate.json の outputs・regions(門の一覧の無い fixture は空)。並びは門の順(after を満たす順) */
function readGenerators(repoRoot) {
  const scriptsDir = join(repoRoot, "scripts");
  if (!existsSync(join(scriptsDir, "runner/gates/gates.json"))) return [];
  return scanTargets(scriptsDir, loadGates(scriptsDir))
    .filter((t) => t.decl.outputs || t.decl.regions)
    .map((t) => ({ name: t.name, outputs: t.decl.outputs, regions: t.decl.regions }));
}

/**
 * intake.txt の生成区画を作り直したテキスト(intake.txt が無いリポ = テストの fixture では null)
 * @returns {{ path: string, content: string } | { problem: string } | null}
 */
export function planIntake(repoRoot, points, switches) {
  const abs = join(repoRoot, INTAKE_FILE);
  if (!existsSync(abs)) return null;
  const replaced = replaceIntakeBlock(readFileSync(abs, "utf8"), intakeRows(points, switches, { ...readScreens(repoRoot), generators: readGenerators(repoRoot) }));
  return "problem" in replaced ? { problem: `${INTAKE_FILE}: ${replaced.problem}` } : { path: INTAKE_FILE, content: replaced.text };
}
