// DB の表の定義（pgTable を持つファイル）の hash。生成の前後で比べ、変わっていれば db:push の案内を出す（forge は db:push を呼ばない）

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

import { scanFeatureTables } from "../structure/registry/tableScan.mjs";

/** 表の定義のファイル: src/features の pgTable を持つ全ファイル（core・business・プロフィールの生成物。registry:generate の schemaRegistry と同じ走査） */
function tableFiles(rootDir) {
  return [...new Set(scanFeatureTables(rootDir).tables.map((table) => path.join(rootDir, table.file)))].sort();
}

/**
 * @param {string} rootDir
 * @returns {Map<string, string>} リポジトリからの相対パス → hash
 */
export function snapshotTables(rootDir) {
  return new Map(
    tableFiles(rootDir).map((file) => [path.relative(rootDir, file), crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex")]),
  );
}

/**
 * @param {Map<string, string>} before
 * @param {Map<string, string>} after
 * @returns {string[]} 増えた・消えた・変わったファイル（名前順）
 */
export function changedTables(before, after) {
  const names = new Set([...before.keys(), ...after.keys()]);
  return [...names].filter((name) => before.get(name) !== after.get(name)).sort();
}
