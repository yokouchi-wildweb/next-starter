// 単位名(印の代わりの同名の検査、D137・計画書 01 S2)。git には触れない純関数の .mjs(宣言は ./declarations.mjs で読む)
// 仕様: ./README.md「判定」
//
// 単位名 = パスから最後の拡張子と末尾の /index を除いた名前(.replace / .override は名前の一部として残す)。
//   x.ts と x.tsx、x.ts と x/index.ts は同じ単位 x。fork が足したパスが、基準(merge-base)にある単位と同じなら同名(unit-clash)。
// 検査する場所(計画書 S2 の場所だけ。components・hooks・utils・src/lib は対象外):
// - 受け口のフォルダ(基準の src/**/extensionPoints.ts の dir:、"." = 持ち主の直下)・src/wiring・scripts・scripts/tasks・
//   … 直下の項目だけ(項目のフォルダの中の部品は見ない。門番の例外 src/featureGate/alwaysOnExceptions も宣言の受け口)
// - route の隣(src/app/**/_layout・_screen・_components)… その下全部
// <対象>.override.ts(x) の対象の単位 = 同じフォルダの <対象>(fork が足した override の対象が基準に無い = override-own。frame.override.ts は frame / page / layout)。
// src/app の frame.ts を fork が足した隣に基準の page / layout がある = frame-beside-parent(上流の隣は frame.override.ts)。

import { readDeclaration } from "./declarations.mjs";

const DIRECT_FIXED = ["src/wiring", "scripts", "scripts/tasks"];
const ROUTE_NEIGHBOUR = /^src\/app\/(?:.*\/)?(?:_layout|_screen|_components)\//;
const DECLARATION = /^src\/(?:.*\/)?extensionPoints\.ts$/;

/** パスの単位名(最後の拡張子と末尾の /index を除く) */
export function unitName(path) {
  const slash = path.lastIndexOf("/");
  const name = path.slice(slash + 1);
  const dot = name.lastIndexOf(".");
  const stem = path.slice(0, dot > 0 ? slash + 1 + dot : path.length);
  return stem.endsWith("/index") ? stem.slice(0, -"/index".length) : stem;
}

const dirOf = (path) => path.slice(0, Math.max(path.lastIndexOf("/"), 0));

const normalize = (path) => {
  const out = [];
  for (const part of path.split("/")) {
    if (part === "" || part === ".") continue;
    if (part === "..") out.pop();
    else out.push(part);
  }
  return out.join("/");
};

/**
 * 基準のファイルの一覧から検査する場所を組み立てる
 * @param {Iterable<string>} baseFiles 基準のファイル(リポジトリ直下からの相対)
 * @param {(path: string) => string | null} readBase 基準側の中身
 * @returns {{ direct: Set<string> }} direct = 直下の項目だけを見るフォルダ(route の隣は形で決まるので持たない)
 */
export function unitPlaces(baseFiles, readBase) {
  const direct = new Set(DIRECT_FIXED);
  for (const path of baseFiles) {
    if (!DECLARATION.test(path)) continue;
    const owner = dirOf(path);
    // 宣言の唯一の読み手で読む(形の誤りのある宣言は点 0。止めるのは extensions:check)
    for (const point of Object.values(readDeclaration(path, readBase(path) ?? "").points)) {
      if (typeof point.dir === "string") direct.add(normalize(`${owner}/${point.dir}`));
    }
  }
  return { direct };
}

/**
 * 検査する場所の中のパスなら単位名、外なら null
 * @param {string} path
 * @param {{ direct: Set<string> }} places
 */
export function placeUnitOf(path, places) {
  const unit = unitName(path);
  if (ROUTE_NEIGHBOUR.test(path)) return unit;
  return places.direct.has(dirOf(unit)) ? unit : null;
}

/** <対象>.override.ts(x) なら対象の単位名(同じフォルダの <対象>)、違えば null。cron の素の override.ts は対象を持たない */
export function overrideTargetUnit(path) {
  const match = /^(.*\/)?([^/]+)\.override\.tsx?$/.exec(path);
  return match ? `${match[1] ?? ""}${match[2]}` : null;
}

/**
 * override の対象の単位名の候補(どれかが基準にあれば上の Tier の物への override)。
 * src/app の frame.override.ts は隣の frame / page / layout(frame.ts の無い上流のページにも重ねられる)。override でなければ空
 */
export function overrideTargetUnits(path) {
  const target = overrideTargetUnit(path);
  if (target === null) return [];
  return /^src\/app\/(?:.*\/)?frame$/.test(target) ? ["frame", "page", "layout"].map((name) => `${target.slice(0, -"frame".length)}${name}`) : [target];
}

/** fork が足した src/app の frame.ts なら、隣の page / layout の単位名(基準にあれば frame-beside-parent)。違えば空 */
export function frameNeighbourUnits(path) {
  const match = /^(src\/app\/(?:.*\/)?)frame\.ts$/.exec(path);
  return match ? [`${match[1]}page`, `${match[1]}layout`] : [];
}

/** 基準のファイルの単位名 → 基準のパス(最初の 1 つ) */
export function unitIndex(baseFiles) {
  const index = new Map();
  for (const path of baseFiles) {
    const unit = unitName(path);
    if (!index.has(unit)) index.set(unit, path);
  }
  return index;
}
