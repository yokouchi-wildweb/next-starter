// src/lib/districtMap/node.mjs
// 入口 "./node": 今の木を node:fs で読む物と node:path を使う物(道具・検査・テスト用。アプリのコードは地図を読まない、目録 D12)。
// ファイルを読まない物は入口 "."(./index.mjs)。同じ名前を 2 つの入口に置かない

import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

import { isGeneratedRegistration, isRegisteredRegistration, readDomain } from "../domain/node.mjs";
import { readDistrictMap } from "./read.mjs";

export { collectPoints, findDeclarationFiles, overrideKeysOf } from "./declarationFiles.mjs";
export { DOMAIN_OUTPUTS_FILE, OUTPUT_KINDS, domainNamesOf, intakeOutputGlobs, isDomainTemplateGlob, matchDomainOutput, normalizeGateOutputs, parseDomainOutputs } from "./domainOutputs.mjs";

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
export const readDistrictMapAt = (repoRoot) => readDistrictMap(nodeDistrictSource(repoRoot), { readDomain, isGeneratedRegistration, isRegisteredRegistration });
