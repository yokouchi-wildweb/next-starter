// src/lib/libPackage/index.mjs
//
// lib の package.json(宣言)の決まりのうち、ファイルを読まずに使える物(入口 ".": client でも server でも読める)。
// 今の木を node:fs で読む読み手と形の検査は ./node.mjs(入口 "./node")。形と決まり: README.md
//
// 形: { "exports": { ".": "./index.ts", "./server": "./server.ts" }, "libs": ["cn"], "peers": ["components"], "sideEffects": false }
// - exports(必須)= 外から読める入口。鍵 = 実パス("." = ./index.<ext>、"./x" = ./x.<ext> か ./x/index.<ext>)、値 = 文字列 1 つ
// - libs = 読む lib の名前(src/lib/<name>)、peers = 共有の同一性が要る棚(今は components = src/components)
// - sideEffects = false か、副作用のあるファイルの一覧(測った所だけ。D86)
// - name・dependencies など他のキーは書かない

import { entryPathOf, toPosix } from "./entryPath.mjs";

export const LIB_DIR = "src/lib";
/** peers に書ける項目 → その置き場(repo 相対) */
export const PEER_DIRS = Object.freeze({ components: "src/components" });
export const ALLOWED_KEYS = Object.freeze(["exports", "libs", "peers", "sideEffects"]);
/** exports の値に使える拡張子 */
export { ENTRY_EXTENSIONS } from "./entryPath.mjs";

/**
 * @typedef {{ lib: string, code: string, message: string }} LibPackageProblem 形の問題 1 つ
 * @typedef {{ key: string, target: string, keyPath: string, targetPath: string }} LibPackageExport exports の 1 行(keyPath = 拡張子と /index を落とした鍵、targetPath = ./ を落とした値)
 * @typedef {{
 *   lib: string,
 *   dir: string,
 *   file: string,
 *   exports: LibPackageExport[],
 *   libs: string[],
 *   peers: string[],
 *   sideEffects: false | string[] | undefined,
 *   problems: LibPackageProblem[],
 * }} LibPackage 読んだ package.json
 */

/**
 * src/lib 直下の lib の名前の一覧(フォルダだけ、名前順)。読み方を注入する形(node:fs を使わない)。
 * lib の見つけ方の唯一の決まりで、./node の listLibs(root) と地区の地図(src/lib/districtMap)が使う
 * @param {(rel: string) => { name: string, isDir: boolean }[]} listDir フォルダの直下(repo 相対の posix、無ければ [])
 * @returns {string[]}
 */
export function listLibsFrom(listDir) {
  return listDir(LIB_DIR)
    .filter((entry) => entry.isDir)
    .map((entry) => entry.name)
    .sort();
}

/**
 * repo 相対のパスがどの lib の中か(src/lib/<name>/… → name)。lib の外なら null
 * @param {string | null | undefined} relPath
 * @returns {string | null}
 */
export function libOfPath(relPath) {
  if (!relPath) return null;
  const parts = toPosix(relPath).split("/");
  if (parts[0] !== "src" || parts[1] !== "lib" || !parts[2] || parts.length < 3) return null;
  // src/lib 直下のファイル(README.md・CATALOG.md)は lib ではない
  if (parts.length === 3 && parts[2].includes(".")) return null;
  return parts[2];
}

/**
 * repo 相対の解いたパス(resolve-import.mjs の resolveImport の結果。拡張子・index は有っても無くても可)が、
 * その lib の入口(exports の 1 行)に当たるか。当たればその行、当たらなければ null
 * @param {LibPackage | null | undefined} pkg
 * @param {string | null | undefined} resolvedRelPath
 * @returns {LibPackageExport | null}
 */
export function findEntry(pkg, resolvedRelPath) {
  if (!pkg || !resolvedRelPath) return null;
  const rel = toPosix(resolvedRelPath);
  const base = `${pkg.dir}`;
  if (rel !== base && !rel.startsWith(`${base}/`)) return null;
  const inside = entryPathOf(rel === base ? "" : rel.slice(base.length + 1));
  return pkg.exports.find((item) => item.keyPath === inside) ?? null;
}
