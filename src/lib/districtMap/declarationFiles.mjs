// src/lib/districtMap/declarationFiles.mjs
// 拡張点の宣言を今の木から node:fs で探して読む(入口 "./node")。読み方そのものは ./declarations.mjs(ファイルを読まない、入口 ".")

import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";

import { DECLARATION_NAME, EXTENSIONS_DIR_NAME, SEARCH_ROOT, pointsFromFiles, readDeclaration } from "./declarations.mjs";
import { classifyDottedName, oldMarkerProblem } from "./dottedNames.mjs";

/**
 * src の下の宣言のファイルを集める(node_modules・extensions/ の中は見ない)
 * @param {string} repoRoot
 * @returns {{ files: string[], stale: string[] }} リポジトリ直下からの相対パス(並びは path 順)。stale = 旧い形 extensionPoints.<x>.ts
 */
export function findDeclarationFiles(repoRoot) {
  const found = [];
  const stale = [];
  const walk = (dir) => {
    if (!existsSync(dir)) return;
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (entry.isDirectory()) {
        if (entry.name === "node_modules" || entry.name === EXTENSIONS_DIR_NAME || entry.name.startsWith(".")) continue;
        walk(join(dir, entry.name));
      } else if (entry.name === `${DECLARATION_NAME}.ts`) {
        found.push(relative(repoRoot, join(dir, entry.name)).split("\\").join("/"));
      } else if (/\.tsx?$/.test(entry.name) && classifyDottedName(entry.name).base === DECLARATION_NAME && classifyDottedName(entry.name).kind !== "test") {
        stale.push(relative(repoRoot, join(dir, entry.name)).split("\\").join("/"));
      }
    }
  };
  walk(join(repoRoot, SEARCH_ROOT));
  return { files: found.sort(), stale: stale.sort() };
}

/** このモジュールの置き場から見たリポジトリ直下(src/lib/districtMap/ の 3 つ上) */
const OWN_REPO_ROOT = fileURLToPath(new URL("../../../", import.meta.url));
const overrideKeysMemo = new Map();

/**
 * 上書きの対象の点(overrides の点)が宣言する、上書きしてよい鍵。読み手(ロール・cron・登録表)が自前の一覧を持たず、ここから読む。
 * 宣言は上流の仕組みの物なので、fixture の根でなくこのリポジトリの宣言を読む
 * @param {string} declaredIn 宣言のファイル(リポジトリ直下からの相対。例 src/lib/cron/extensionPoints.ts)
 * @param {string} pointName 点の名前
 * @param {string} [repoRoot] 既定 = このモジュールのリポジトリ(テストだけが差し替える)
 * @returns {string[]}
 */
export function overrideKeysOf(declaredIn, pointName, repoRoot = OWN_REPO_ROOT) {
  const memoKey = `${repoRoot}\0${declaredIn}\0${pointName}`;
  if (overrideKeysMemo.has(memoKey)) return overrideKeysMemo.get(memoKey);
  const file = join(repoRoot, declaredIn);
  if (!existsSync(file)) throw new Error(`${declaredIn} が無い(上書きしてよい鍵の宣言)`);
  const { points, problems } = readDeclaration(declaredIn, readFileSync(file, "utf8"));
  if (problems.length > 0) throw new Error(problems.join("\n"));
  const point = points[pointName];
  if (!point) throw new Error(`${declaredIn} に点 ${pointName} が無い(上書きしてよい鍵の宣言)`);
  if (point.overrides === undefined) throw new Error(`${declaredIn} の ${pointName} は overrides の点でない(上書きの対象の点は { overrides, side, overrideOf })`);
  const keys = [...point.overrideOf];
  overrideKeysMemo.set(memoKey, keys);
  return keys;
}

/**
 * 全宣言を読んで点の一覧にする。宣言は 1 フォルダ 1 ファイル(extensionPoints.ts)なので 持ち主:点の名前 は重ならない。
 * fork の点は fork 自身のフォルダ(fork が足したドメイン・lib)の extensionPoints.ts に書く
 * @param {string} repoRoot
 * @returns {{ points: { owner: string, name: string, declaredIn: string, spec: object }[], problems: string[] }}
 */
export function collectPoints(repoRoot) {
  const problems = [];
  const { files, stale } = findDeclarationFiles(repoRoot);
  for (const path of stale) {
    problems.push(`${oldMarkerProblem(path, `${DECLARATION_NAME}.ts`)}。fork の拡張点は fork 自身のフォルダの ${DECLARATION_NAME}.ts に宣言する`);
  }
  const read = pointsFromFiles(files, (path) => readFileSync(join(repoRoot, path), "utf8"));
  return { points: read.points, problems: [...problems, ...read.problems] };
}
