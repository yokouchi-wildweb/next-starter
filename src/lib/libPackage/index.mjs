// src/lib/libPackage/index.mjs
//
// lib の package.json(宣言)の唯一の読み手。lint(eslint-rules/import-boundaries.mjs の lib-entry・lib-self-relative)、
// 単体用 tsconfig と sideEffects の検査(scripts/structure/libPackage)、閉じたかの検査が同じものを読む。
// Node 組み込みだけを読む(features・他の lib を読まない)。形と決まり: README.md
//
// 形: { "exports": { ".": "./index.ts", "./server": "./server.ts" }, "libs": ["cn"], "peers": ["components"], "sideEffects": false }
// - exports(必須)= 外から読める入口。鍵 = 実パス("." = ./index.<ext>、"./x" = ./x.<ext> か ./x/index.<ext>)、値 = 文字列 1 つ
// - libs = 読む lib の名前(src/lib/<name>)、peers = 共有の同一性が要る棚(今は components = src/components)
// - sideEffects = false か、副作用のあるファイルの一覧(測った所だけ。D86)
// - name・dependencies など他のキーは書かない

import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

export const LIB_DIR = "src/lib";
/** peers に書ける項目 → その置き場(repo 相対) */
export const PEER_DIRS = Object.freeze({ components: "src/components" });
export const ALLOWED_KEYS = Object.freeze(["exports", "libs", "peers", "sideEffects"]);
/** exports の値に使える拡張子 */
export const ENTRY_EXTENSIONS = Object.freeze(["ts", "tsx", "mts", "mjs", "js"]);

const EXT_RE = new RegExp(`\\.(${ENTRY_EXTENSIONS.join("|")})$`);
const cache = new Map();

const toPosix = (p) => p.split(path.sep).join("/");

/** src/lib 直下の lib の名前の一覧(フォルダだけ、名前順) */
export function listLibs(root) {
  const dir = path.join(root, LIB_DIR);
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();
}

/** その lib が package.json を持つか */
export function hasLibPackage(root, lib) {
  return existsSync(path.join(root, LIB_DIR, lib, "package.json"));
}

/** package.json を持つ lib の名前の一覧 */
export function listDeclaredLibs(root) {
  return listLibs(root).filter((lib) => hasLibPackage(root, lib));
}

/** repo 相対のパスがどの lib の中か(src/lib/<name>/… → name)。lib の外なら null */
export function libOfPath(relPath) {
  if (!relPath) return null;
  const parts = toPosix(relPath).split("/");
  if (parts[0] !== "src" || parts[1] !== "lib" || !parts[2] || parts.length < 3) return null;
  // src/lib 直下のファイル(README.md・CATALOG.md)は lib ではない
  if (parts.length === 3 && parts[2].includes(".")) return null;
  return parts[2];
}

/** 拡張子と末尾の /index を落とした形(入口の照合用。"" = lib の根) */
function entryPathOf(relInsideLib) {
  let p = relInsideLib.replace(/^\.\/?/, "").replace(EXT_RE, "");
  if (p === "index") return "";
  if (p.endsWith("/index")) p = p.slice(0, -"/index".length);
  return p;
}

function problem(lib, code, message) {
  return { lib, code, message };
}

/** exports の 1 行を確かめる。問題の一覧を返す */
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

function readUncached(root, lib) {
  const file = path.join(root, LIB_DIR, lib, "package.json");
  if (!existsSync(file)) return null;
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
    pkg.problems.push(problem(lib, "json", `package.json を JSON として読めません: ${error.message}`));
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
        pkg.exports.push({ key, target, keyPath: entryPathOf(key === "." ? "" : key), targetPath: target.replace(/^\.\//, "") });
      }
    }
  }

  // libs
  if (json.libs !== undefined) {
    if (!Array.isArray(json.libs) || json.libs.some((item) => typeof item !== "string")) {
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
    if (!Array.isArray(json.peers) || json.peers.some((item) => typeof item !== "string")) {
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

/** その lib の package.json の形の問題の一覧(package.json が無ければ空) */
export function checkLibPackage(root, lib) {
  return readLibPackage(root, lib)?.problems ?? [];
}

/** package.json を持つ lib ごとの報告 */
export function checkAllLibPackages(root) {
  const libs = listDeclaredLibs(root).map((lib) => ({ lib, problems: checkLibPackage(root, lib) }));
  return { libs, declared: libs.length, problemCount: libs.reduce((sum, item) => sum + item.problems.length, 0) };
}

/**
 * repo 相対の解いたパス(resolve-import.mjs の resolveImport の結果。拡張子・index は有っても無くても可)が、
 * その lib の入口(exports の 1 行)に当たるか。当たればその行、当たらなければ null
 */
export function findEntry(pkg, resolvedRelPath) {
  if (!pkg || !resolvedRelPath) return null;
  const rel = toPosix(resolvedRelPath);
  const base = `${pkg.dir}`;
  if (rel !== base && !rel.startsWith(`${base}/`)) return null;
  const inside = entryPathOf(rel === base ? "" : rel.slice(base.length + 1));
  return pkg.exports.find((item) => item.keyPath === inside) ?? null;
}
