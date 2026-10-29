// DB の表の定義（drizzle.ts）の hash。生成の前後で比べ、変わっていれば db:push の案内を出す（forge は db:push を呼ばない）

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

/** 表の定義のファイル: business の entities/drizzle.ts とプロフィールの generated/<role>/drizzle.ts */
function tableFiles(rootDir) {
  const featuresDir = path.join(rootDir, "src", "features");
  const files = [];
  if (fs.existsSync(featuresDir)) {
    for (const name of fs.readdirSync(featuresDir)) {
      const file = path.join(featuresDir, name, "entities", "drizzle.ts");
      if (fs.existsSync(file)) files.push(file);
    }
  }
  const generatedDir = path.join(featuresDir, "core", "userProfile", "generated");
  if (fs.existsSync(generatedDir)) {
    for (const name of fs.readdirSync(generatedDir)) {
      const file = path.join(generatedDir, name, "drizzle.ts");
      if (fs.existsSync(file)) files.push(file);
    }
  }
  return files.sort();
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
