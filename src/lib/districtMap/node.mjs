// src/lib/districtMap/node.mjs
// 今の木を node:fs で読む入口(道具・検査・テスト用。アプリのコードは地図を読まない、目録 D12)。

import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

import { readDistrictMap } from "./read.mjs";

/**
 * リポジトリの木を読む source(readDistrictMap に渡す)
 * @param {string} repoRoot
 * @returns {import("./read.mjs").DistrictSource}
 */
export function nodeDistrictSource(repoRoot) {
  return {
    listDir(rel) {
      const abs = join(repoRoot, rel);
      if (!existsSync(abs) || !statSync(abs).isDirectory()) return [];
      return readdirSync(abs, { withFileTypes: true })
        .map((e) => ({ name: e.name, isDir: e.isDirectory() }))
        .sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
    },
    readText(rel) {
      const abs = join(repoRoot, rel);
      return existsSync(abs) && statSync(abs).isFile() ? readFileSync(abs, "utf8") : null;
    },
  };
}

/**
 * リポジトリの地区の地図
 * @param {string} repoRoot
 */
export const readDistrictMapAt = (repoRoot) => readDistrictMap(nodeDistrictSource(repoRoot));
