// src/lib/districtMap/intakeRows.mjs
// 受け口の一覧(src/lib/forkOwnership/intake.txt)の生成区画の行を、宣言 2 段の読み手として組む(地区の議会 D35: 読み手 1 つが地図の forkCan と可変域の src の行を導く)。
// ファイルを読まない純関数。入力を集めるのは scripts/structure/extensions/intake.mjs(pnpm generate extensions が書き、pnpm check extensions がずれを止める)。
// 入力: 宣言の点(add・override・counterpart・replace)/ 差替点のスイッチ(1 行スイッチの検査が確かめた組)/ ルートの画面と枠の 1 行スイッチ / 生成器の phase.json。
// 画面と枠の 1 行スイッチは地区と 1 対 1 でない(ルートごと、1 ルート = 1 Screen の決まりは src/lib/screens)ので、差替点の宣言でなくルートの一覧を入力に取る(注文 16 Q3)。
// 行の kind: 受け口の項目・丸ごと置き換え・足してよい対象(addable)= add、1 行スイッチの素の名前・上書きの対象の点の <対象>.override.ts = edit。書式: scripts/structure/extensions/README.md

import { PLUGS_DIR_NAME, isListPoint, isPlugsPoint } from "./declarations.mjs";
import { overrideGlobOf } from "./extensionNames.mjs";

/** 宣言に依らない受け口(route の隣の丸ごと置き換え・枠の宣言)。ドメインのタスクは fork 自身のドメインに置くので受け口の行は無い */
const FIXED_ROWS = [
  "add src/app/**/_layout/**/*.replace.{ts,tsx}  # 枠の部品の丸ごと置き換え(_layout の隣の <名前>.replace)",
  "add src/app/**/_screen/**/*.replace.{ts,tsx}  # Screen の丸ごと置き換え(_screen の隣の <名前>.replace)",
  "add src/app/**/frame.override.ts  # 枠の宣言(下のリポ。相手 = 上流のルート。ルートを作ったリポの宣言は frame.ts、src/app/_layout/frame/README.md)",
];

/** 実在のパスを、そのパスだけに当たる glob にする(node:path の matchesGlob。[slug] などの字の組・* ? は [x] で包む。\ の逃がしは効かない) */
export const literalGlob = (/** @type {string} */ path) => path.replace(/[[\]*?]/g, (ch) => `[${ch}]`);

/** 持ち主のフォルダ + 点の dir(リポジトリ直下からの相対、"." = 持ち主の直下。.. は宣言の検査が止める) */
const dirOf = (/** @type {string} */ owner, /** @type {string} */ dir) => [owner, ...dir.split("/").filter((seg) => seg !== "" && seg !== ".")].join("/");

/**
 * 生成区画の行。並びは効く種類を決める(最後に当たった行が効く): 置き場 → 画面 → 受け口 → 差替点 → 上書き → route の隣 → 生成器の region → 生成物
 * @param {{
 *   points: { owner: string, name: string, declaredIn: string, spec: import("./declarations.mjs").PointSpec }[],
 *   switches?: { path: string, point: string, declaredIn: string }[],
 *   pages?: string[], frameSwitches?: string[],
 *   generators?: { name: string, outputs?: string[], regions?: string[] }[],
 * }} input points = 全拡張点 / switches = 差替点の 1 行スイッチ(<dir>/<名前>.ts(x))/ pages = ルートの page.tsx / frameSwitches = 枠の 1 行スイッチの layout.tsx / generators = phase.json の outputs・regions
 * @returns {string[]}
 */
export function intakeRowsOf({ points, switches = [], pages = [], frameSwitches = [], generators = [] }) {
  /** @type {Map<string, { names: string[], files: Set<string>, plain: boolean }>} */
  const byDir = new Map();
  // plugs の点は行を出さない(項目は差す側の自分のフォルダ。上流のドメイン・lib の中に fork は足さない、D38)
  for (const point of points.filter((p) => isListPoint(p.spec) && !isPlugsPoint(p.spec))) {
    const dir = dirOf(point.owner, String(point.spec.dir));
    const entry = byDir.get(dir) ?? { names: [], files: new Set(), plain: false };
    entry.names.push(point.name);
    if (typeof point.spec.files === "string") {
      const file = point.spec.files.slice("*/".length);
      entry.files.add(file);
      // files の点の override(項目のファイルの隣、overrideOf の点)
      if (point.spec.overrideOf) entry.files.add(`${file.replace(/\.tsx?$/, "")}.override.{ts,tsx}`);
    } else entry.plain = true;
    byDir.set(dir, entry);
  }
  const rows = ["# pnpm generate extensions が拡張点の宣言(extensionPoints.ts)・ルート・生成器の phase.json から書く(読み手 src/lib/districtMap/intakeRows.mjs)。手で編集しない(ずれは pnpm check extensions が止める)"];
  // 置き場の点(counterpart の placement): fork が書いてよい場所とその書き方
  for (const point of points.filter((p) => p.spec.placement !== undefined)) {
    rows.push(`${point.spec.kind} ${point.spec.placement}  # 置き場 ${point.name}(${point.declaredIn})`);
  }
  // 画面(型 1): ルートの page.tsx と枠の layout.tsx の 1 行スイッチ(向け先を _components/ に替える)
  for (const page of [...pages].sort()) rows.push(`edit ${literalGlob(page)}  # 画面の 1 行スイッチ`);
  for (const layout of [...frameSwitches].sort()) rows.push(`edit ${literalGlob(layout)}  # 枠の 1 行スイッチ`);
  // 増設点(add の受け口)
  for (const [dir, entry] of [...byDir.entries()].sort(([a], [b]) => (a < b ? -1 : 1))) {
    const label = `受け口 ${entry.names.join("・")}`;
    if (entry.plain) {
      rows.push(`add ${dir}/*.{ts,tsx}  # ${label}`);
      rows.push(`add ${dir}/*/**  # ${label}(フォルダ形)`);
    }
    for (const file of [...entry.files].sort()) rows.push(`add ${dir}/*/${file}  # ${label}`);
  }
  // plugs の点の上書き(注文 25): 上流の項目の隣の <名前>.override.ts だけ(項目そのものは差す側の自分のフォルダ、D38)。
  // 置き場は上流のドメインと lib の plugs/<点>/(files の点は項目のフォルダの中の <ファイル>.override)。itemsOf の点は主の点のフォルダを読む
  for (const point of [...points].filter((p) => isPlugsPoint(p.spec) && Array.isArray(p.spec.overrideOf)).sort((a, b) => (a.name < b.name ? -1 : 1))) {
    const folder = typeof point.spec.itemsOf === "string" ? point.spec.itemsOf : point.name;
    const keys = /** @type {string[]} */ (point.spec.overrideOf).join("・");
    const files = typeof point.spec.files === "string" ? `*/${point.spec.files.slice("*/".length).replace(/\.tsx?$/, "")}.override.{ts,tsx}` : "*.override.{ts,tsx}";
    for (const root of ["src/domains/**", "src/lib/*"]) rows.push(`add ${root}/${PLUGS_DIR_NAME}/${folder}/${files}  # 上書き ${point.name}(${keys})の上流の項目の隣`);
  }
  // 差替点(replace): 呼び手が import する素の名前は edit(向け先を ./<名前>.replace に替える)、置き換えの実装は add
  const sortedSwitches = [...switches].sort((a, b) => (a.path < b.path ? -1 : 1));
  for (const s of sortedSwitches) rows.push(`edit ${literalGlob(s.path)}  # 差替点 ${s.point}(${s.declaredIn})の 1 行スイッチ(向け先を ./<名前>.replace に替える)`);
  for (const s of sortedSwitches) rows.push(`add ${s.path.replace(/\.tsx?$/, "")}.replace.{ts,tsx}  # 差替点 ${s.point} の丸ごと置き換え`);
  // 上書点(override の overrides の glob): 隣の <対象>.override.ts は edit、addable の点は対象そのものを足すのが add
  for (const point of [...points].filter((p) => typeof p.spec.overrides === "string").sort((a, b) => (String(a.spec.overrides) < String(b.spec.overrides) ? -1 : 1))) {
    const glob = String(point.spec.overrides);
    const keys = Array.isArray(point.spec.overrideOf) ? point.spec.overrideOf.join("・") : "";
    rows.push(`edit ${overrideGlobOf(glob)}  # 上書き ${point.name}(${keys})`);
    if (point.spec.addable) rows.push(`add ${glob}  # fork が足す ${point.name}(上流の物の変更は隣の .override.ts)`);
  }
  rows.push(...FIXED_ROWS);
  // 生成器(phase.json): region = 書き直しても fork の区画を残すファイル、generated = 丸ごと書くファイル(generated を最後に: 同じファイルなら生成物が効く)
  for (const g of generators) for (const glob of g.regions ?? []) rows.push(`region ${glob}  # 生成器 ${g.name} の fork の区画`);
  for (const g of generators) for (const glob of g.outputs ?? []) rows.push(`generated ${glob}  # 生成器 ${g.name} の出力`);
  return rows;
}
