// src/lib/districtMap/direction.test.mjs — lib の import の向きを縛る: forkOwnership → districtMap の一方向だけ
// この lib の下のファイル(テストを含む)は src/lib/forkOwnership を値でも型でも import しない(両向きだと棚が lib を閉じられない)
// 実行: pnpm test src/lib/districtMap
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const CODE = /\.(mjs|js|ts|tsx|cjs)$/;
// import / export ... from / import() の指定子(コメントの中の言及は見ない)
const SPECIFIER = /^\s*(?:import|export)\b[^"'`]*?\bfrom\s*["']([^"']+)["']|^\s*import\s*["']([^"']+)["']|\bimport\(\s*["']([^"']+)["']\s*\)/gm;

function codeFiles(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return codeFiles(full);
    return CODE.test(entry.name) ? [full] : [];
  });
}

test("districtMap の下は src/lib/forkOwnership を import しない", () => {
  const offenders = [];
  for (const file of codeFiles(HERE)) {
    const text = readFileSync(file, "utf8");
    for (const match of text.matchAll(SPECIFIER)) {
      const specifier = match[1] ?? match[2] ?? match[3];
      const resolved = specifier.startsWith(".") ? path.resolve(path.dirname(file), specifier) : specifier;
      if (/(^|[\\/])lib[\\/]forkOwnership([\\/]|$)/.test(resolved)) offenders.push(`${path.relative(HERE, file)}: ${specifier}`);
    }
  }
  assert.deepEqual(offenders, [], "向きは forkOwnership → districtMap だけ(共有の部品は districtMap の側に置く)");
});
