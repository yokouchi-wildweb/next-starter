// 単位名(印の代わりの同名の検査、D137・計画書 01 S2)。git には触れない純関数の .mjs(宣言は ../districtMap/declarations.mjs で読む)
// 仕様: ./README.md「判定」
//
// 単位名 = パスから最後の拡張子と末尾の /index を除いた名前(.replace / .override は名前の一部として残す)。
//   x.ts と x.tsx、x.ts と x/index.ts は同じ単位 x。fork が足したパスが、基準(merge-base)にある単位と同じなら同名(unit-clash)。
// 検査する場所:
// - 部品の棚(src/components の基準の各分類 <分類>・src/hooks・src/utils・src/lib)… 直下の項目 = 単位(ファイルかフォルダ)。
//   基準の単位のフォルダの中への追加は inside-unit-add(judge.mjs)、新しい単位は可、基準の単位と同じ名前は同名
// - 受け口のフォルダ(基準の src/**/extensionPoints.ts の dir:、"." = 持ち主の直下)・src/wiring・scripts・
//   … 直下の項目だけ(項目のフォルダの中の部品は見ない。門番の例外 src/featureGate/alwaysOnExceptions も宣言の受け口)
// - route の隣(src/app/**/_layout・_screen・_components)… その下全部
// <対象>.override.ts(x) の対象の単位 = 同じフォルダの <対象>(fork が足した override の対象が基準に無い = override-own)。

import { readDeclaration } from "../districtMap/declarations.mjs";

const DIRECT_FIXED = ["src/wiring", "scripts"];
const SHELF_FIXED = ["src/hooks", "src/utils", "src/lib"];
const COMPONENTS = "src/components";
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

/** 部品の棚の場所(shelf の中で、パスがその下にある物。分類 src/components/<分類> を先に見る)。無ければ null */
function shelfPlaceOf(path, shelf) {
  const parts = path.split("/");
  for (const depth of [3, 2]) {
    if (parts.length <= depth) continue;
    const place = parts.slice(0, depth).join("/");
    if (shelf.has(place)) return place;
  }
  return null;
}

/**
 * 基準のファイルの一覧から検査する場所を組み立てる
 * @param {Iterable<string>} baseFiles 基準のファイル(リポジトリ直下からの相対)
 * @param {(path: string) => string | null} readBase 基準側の中身
 * @returns {{ direct: Set<string>, shelf: Set<string>, unitFolders: Set<string> }}
 *   direct = 直下の項目だけを見るフォルダ(route の隣は形で決まるので持たない)
 *   shelf = 部品の棚の場所(基準の分類・hooks・utils・src/lib) | unitFolders = 棚の基準の単位のフォルダ(<場所>/<単位>)
 */
export function unitPlaces(baseFiles, readBase) {
  const files = [...baseFiles];
  const direct = new Set(DIRECT_FIXED);
  const shelf = new Set(SHELF_FIXED);
  for (const path of files) {
    const parts = path.split("/");
    if (path.startsWith(`${COMPONENTS}/`) && parts.length >= 4) shelf.add(parts.slice(0, 3).join("/"));
  }
  const unitFolders = new Set();
  for (const path of files) {
    const place = shelfPlaceOf(path, shelf);
    if (place === null) continue;
    const rest = path.slice(place.length + 1);
    const slash = rest.indexOf("/");
    if (slash > 0) unitFolders.add(`${place}/${rest.slice(0, slash)}`);
  }
  for (const path of files) {
    if (!DECLARATION.test(path)) continue;
    const owner = dirOf(path);
    // 宣言の唯一の読み手で読む(形の誤りのある宣言は点 0。止めるのは pnpm check extensions)
    for (const point of Object.values(readDeclaration(path, readBase(path) ?? "").points)) {
      if (typeof point.dir === "string") direct.add(normalize(`${owner}/${point.dir}`));
    }
  }
  return { direct, shelf, unitFolders };
}

/**
 * 部品の棚の中のパスなら、その単位名(<場所>/<直下の項目>。直下のファイルは最後の拡張子と /index を除く)。棚の外は null
 * @param {string} path
 * @param {{ shelf?: Set<string> }} places
 */
export function shelfUnitOf(path, places) {
  const place = places.shelf ? shelfPlaceOf(path, places.shelf) : null;
  if (place === null) return null;
  const rest = path.slice(place.length + 1);
  const slash = rest.indexOf("/");
  return slash > 0 ? `${place}/${rest.slice(0, slash)}` : unitName(path);
}

/**
 * 基準の単位のフォルダの中のパスなら、そのフォルダ(<場所>/<単位>)。違えば null
 * @param {string} path
 * @param {{ shelf?: Set<string>, unitFolders?: Set<string> }} places
 */
export function unitFolderOf(path, places) {
  const place = places.shelf ? shelfPlaceOf(path, places.shelf) : null;
  if (place === null) return null;
  const rest = path.slice(place.length + 1);
  const slash = rest.indexOf("/");
  const folder = slash > 0 ? `${place}/${rest.slice(0, slash)}` : null;
  return folder !== null && places.unitFolders?.has(folder) ? folder : null;
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

/** <対象>.override.ts(x) なら対象の単位名(同じフォルダの <対象>。cron の task.override.ts は task)、違えば null */
export function overrideTargetUnit(path) {
  const match = /^(.*\/)?([^/]+)\.override\.tsx?$/.exec(path);
  return match ? `${match[1] ?? ""}${match[2]}` : null;
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
