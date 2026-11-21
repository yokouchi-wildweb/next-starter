// src/lib/libPackage/node.mjs
//
// lib の package.json(宣言)の唯一の読み手と形の検査(入口 "./node": Next の外のプログラム = lint・scripts・テストが読む)。
// 今の木を node:fs で読む。Node 組み込みとこの lib の "." だけを読む(他の lib・features・React・Next を読まない)。形と決まり: README.md

import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

import { ENTRY_EXTENSIONS, EXT_RE, entryPathOf } from "./entryPath.mjs";
import { ALLOWED_KEYS, LIB_DIR, PEER_DIRS, listLibsFrom } from "./index.mjs";

/**
 * @typedef {import("./index.mjs").LibPackage} LibPackage
 * @typedef {import("./index.mjs").LibPackageProblem} LibPackageProblem
 */

const cache = new Map();

/**
 * src/lib 直下の lib の名前の一覧(フォルダだけ、名前順)。今の木を node:fs で読む
 * @param {string} root
 * @returns {string[]}
 */
export function listLibs(root) {
  return listLibsFrom((rel) => {
    const dir = path.join(root, rel);
    if (!existsSync(dir)) return [];
    return readdirSync(dir, { withFileTypes: true }).map((entry) => ({ name: entry.name, isDir: entry.isDirectory() }));
  });
}

/**
 * その lib が package.json を持つか
 * @param {string} root
 * @param {string} lib
 * @returns {boolean}
 */
export function hasLibPackage(root, lib) {
  return existsSync(path.join(root, LIB_DIR, lib, "package.json"));
}

/**
 * package.json を持つ lib の名前の一覧
 * @param {string} root
 * @returns {string[]}
 */
export function listDeclaredLibs(root) {
  return listLibs(root).filter((lib) => hasLibPackage(root, lib));
}

/**
 * @param {string} lib
 * @param {string} code
 * @param {string} message
 * @returns {LibPackageProblem}
 */
function problem(lib, code, message) {
  return { lib, code, message };
}

/**
 * exports の 1 行を確かめる。問題の一覧を返す
 * @param {string} root
 * @param {string} lib
 * @param {string} key
 * @param {unknown} target
 * @returns {LibPackageProblem[]}
 */
function checkExport(root, lib, key, target) {
  const out = [];
  if (key.includes("*")) out.push(problem(lib, "pattern", `exports の鍵 "${key}" にパターン * は使えません(入口を 1 つずつ書きます)`));
  if (target === null || typeof target !== "string") {
    out.push(problem(lib, "condition", `exports "${key}" の値は文字列 1 つです(条件分け・配列・null は使えません)`));
    return out;
  }
  if (target.includes("*")) out.push(problem(lib, "pattern", `exports "${key}" の値 "${target}" にパターン * は使えません`));
  if (key !== "." && !/^\.\/[^.]/.test(key)) {
    out.push(problem(lib, "keyForm", `exports の鍵 "${key}" は "." か "./<パス>" で書きます`));
  }
  if (!target.startsWith("./") || target.split("/").includes("..")) {
    out.push(problem(lib, "targetOutside", `exports "${key}" の値 "${target}" は lib の中の "./<パス>" で書きます`));
    return out;
  }
  if (!EXT_RE.test(target)) {
    out.push(problem(lib, "targetExt", `exports "${key}" の値 "${target}" はファイル(.${ENTRY_EXTENSIONS.join(" / .")})を指します`));
  }
  if (out.length > 0) return out;
  if (entryPathOf(key === "." ? "" : key) !== entryPathOf(target)) {
    out.push(
      problem(lib, "keyMismatch", `exports の鍵 "${key}" と値 "${target}" が一致しません(鍵 = 実パス: "." は ./index.<ext>、"./x" は ./x.<ext> か ./x/index.<ext>)`),
    );
  }
  const file = path.join(root, LIB_DIR, lib, target);
  if (!existsSync(file) || !statSync(file).isFile()) {
    out.push(problem(lib, "targetMissing", `exports "${key}" の先 "${target}" がありません`));
  }
  return out;
}

/**
 * @param {string} root
 * @param {string} lib
 * @returns {LibPackage | null}
 */
function readUncached(root, lib) {
  const file = path.join(root, LIB_DIR, lib, "package.json");
  if (!existsSync(file)) return null;
  /** @type {LibPackage} */
  const pkg = {
    lib,
    dir: `${LIB_DIR}/${lib}`,
    file: `${LIB_DIR}/${lib}/package.json`,
    exports: [],
    libs: [],
    peers: [],
    sideEffects: undefined,
    problems: [],
  };
  let json;
  try {
    json = JSON.parse(readFileSync(file, "utf8"));
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    pkg.problems.push(problem(lib, "json", `package.json を JSON として読めません: ${reason}`));
    return pkg;
  }
  if (json === null || typeof json !== "object" || Array.isArray(json)) {
    pkg.problems.push(problem(lib, "json", "package.json はオブジェクトです"));
    return pkg;
  }
  for (const key of Object.keys(json)) {
    if (key === "name") pkg.problems.push(problem(lib, "name", 'package.json に "name" は書きません(lib は @/lib/<名前> で読みます)'));
    else if (!ALLOWED_KEYS.includes(key)) {
      pkg.problems.push(problem(lib, "unknownKey", `package.json のキー "${key}" は使えません(使えるのは ${ALLOWED_KEYS.join(" / ")})`));
    }
  }

  // exports
  const exportsValue = json.exports;
  if (exportsValue === undefined) {
    pkg.problems.push(problem(lib, "exportsMissing", 'package.json に "exports"(入口の一覧)がありません'));
  } else if (exportsValue === null || typeof exportsValue !== "object" || Array.isArray(exportsValue) || Object.keys(exportsValue).length === 0) {
    pkg.problems.push(problem(lib, "exportsShape", '"exports" は { "<鍵>": "<実パス>" } のオブジェクトで、入口を 1 つ以上書きます'));
  } else {
    for (const [key, target] of Object.entries(exportsValue)) {
      const found = checkExport(root, lib, key, target);
      pkg.problems.push(...found);
      if (found.length === 0) {
        if (typeof target !== "string") continue; // 問題 0 = 文字列(checkExport が確かめた)
        pkg.exports.push({ key, target, keyPath: entryPathOf(key === "." ? "" : key), targetPath: target.replace(/^\.\//, "") });
      }
    }
  }

  // libs
  if (json.libs !== undefined) {
    if (!Array.isArray(json.libs) || json.libs.some((/** @type {unknown} */ item) => typeof item !== "string")) {
      pkg.problems.push(problem(lib, "libsShape", '"libs" は lib の名前の配列です'));
    } else {
      const known = new Set(listLibs(root));
      const seen = new Set();
      for (const name of json.libs) {
        if (seen.has(name)) pkg.problems.push(problem(lib, "libDuplicate", `"libs" に "${name}" が 2 回あります`));
        else if (name === lib) pkg.problems.push(problem(lib, "libSelf", `"libs" に自分 "${name}" は書きません`));
        else if (!known.has(name)) pkg.problems.push(problem(lib, "libUnknown", `"libs" の "${name}" は src/lib にありません`));
        else pkg.libs.push(name);
        seen.add(name);
      }
    }
  }

  // peers
  if (json.peers !== undefined) {
    if (!Array.isArray(json.peers) || json.peers.some((/** @type {unknown} */ item) => typeof item !== "string")) {
      pkg.problems.push(problem(lib, "peersShape", '"peers" は棚の名前の配列です'));
    } else {
      const seen = new Set();
      for (const name of json.peers) {
        if (seen.has(name)) pkg.problems.push(problem(lib, "peerDuplicate", `"peers" に "${name}" が 2 回あります`));
        else if (!Object.hasOwn(PEER_DIRS, name)) {
          pkg.problems.push(problem(lib, "peerUnknown", `"peers" の "${name}" は使えません(使えるのは ${Object.keys(PEER_DIRS).join(" / ")})`));
        } else pkg.peers.push(name);
        seen.add(name);
      }
    }
  }

  // sideEffects
  if (json.sideEffects !== undefined) {
    const value = json.sideEffects;
    if (value === false) pkg.sideEffects = false;
    else if (Array.isArray(value) && value.length > 0 && value.every((item) => typeof item === "string")) pkg.sideEffects = [...value];
    else pkg.problems.push(problem(lib, "sideEffectsShape", '"sideEffects" は false か、副作用のあるファイルの一覧(文字列の配列)です'));
  }
  return pkg;
}

/**
 * lib の package.json を読む。無ければ null。形の問題は problems に入れる(問題のある exports の行は exports に入れない)
 * 結果は root + lib ごとに覚える(1 プロセスの間。clearLibPackageCache で消す)
 * @param {string} root
 * @param {string} lib
 * @returns {LibPackage | null}
 */
export function readLibPackage(root, lib) {
  const key = `${root}\0${lib}`;
  if (!cache.has(key)) cache.set(key, readUncached(root, lib));
  return cache.get(key);
}

/** 覚えた結果を消す(テスト・ファイルを書き換えた後) */
export function clearLibPackageCache() {
  cache.clear();
}

/**
 * その lib の package.json の形の問題の一覧(package.json が無ければ空)
 * @param {string} root
 * @param {string} lib
 * @returns {LibPackageProblem[]}
 */
export function checkLibPackage(root, lib) {
  return readLibPackage(root, lib)?.problems ?? [];
}

/**
 * package.json を持つ lib ごとの報告
 * @param {string} root
 * @returns {{ libs: { lib: string, problems: LibPackageProblem[] }[], declared: number, problemCount: number }}
 */
export function checkAllLibPackages(root) {
  const libs = listDeclaredLibs(root).map((lib) => ({ lib, problems: checkLibPackage(root, lib) }));
  return { libs, declared: libs.length, problemCount: libs.reduce((sum, item) => sum + item.problems.length, 0) };
}
