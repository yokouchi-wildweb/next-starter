// src/lib/domain/definition/nodeDomainSource.mjs
// 今の木を node:fs で読む source(readDomain・地区の地図に渡す)。読み込みの部品 ./readDomain.mjs はファイルを開かないので、node の物はここだけ

import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

import { byName } from "./readDomain.mjs";

/**
 * リポジトリの木を読む source
 * @param {string} repoRoot
 * @returns {import("./readDomain.mjs").DomainSource}
 */
export function nodeDomainSource(repoRoot) {
  return {
    listDir(rel) {
      const abs = join(repoRoot, rel);
      if (!existsSync(abs) || !statSync(abs).isDirectory()) return [];
      return readdirSync(abs, { withFileTypes: true })
        .map((entry) => ({ name: entry.name, isDir: entry.isDirectory() }))
        .sort((a, b) => byName(a.name, b.name));
    },
    readText(rel) {
      const abs = join(repoRoot, rel);
      return existsSync(abs) && statSync(abs).isFile() ? readFileSync(abs, "utf8") : null;
    },
  };
}
