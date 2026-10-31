// scripts/cycles/cycles.test.mjs
// src 全体に静的な値の import の輪が無いこと(D24・D25)と、判定の契約。
// 実行: pnpm test:cycles(build の冒頭でも走る)

import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";

import { findStaticCycles, scanCycles } from "./cycles.mjs";

const fixture = async (files) => {
  const dir = mkdtempSync(path.join(tmpdir(), "cycles-"));
  try {
    for (const [name, code] of Object.entries(files)) {
      mkdirSync(path.dirname(path.join(dir, name)), { recursive: true });
      writeFileSync(path.join(dir, name), code);
    }
    return await scanCycles({ context: dir, entries: ["src/**/*.ts"] });
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
};

test("値の輪を見つける", async () => {
  const cycles = await fixture({
    "src/a.ts": `import { b } from "./b";\nexport const a = () => b;\n`,
    "src/b.ts": `import { a } from "./a";\nexport const b = () => a;\n`,
  });
  assert.deepEqual(cycles, [["src/a.ts", "src/b.ts"]]);
});

test("型だけの輪は通す", async () => {
  const cycles = await fixture({
    "src/a.ts": `import type { B } from "./b";\nexport type A = { b: B };\nexport const a = 1;\n`,
    "src/b.ts": `import { a } from "./a";\nexport type B = number;\nexport const b = a;\n`,
  });
  assert.deepEqual(cycles, []);
});

test("import() で閉じる輪は通す", async () => {
  const cycles = await fixture({
    "src/a.ts": `export const a = () => import("./b");\n`,
    "src/b.ts": `import { a } from "./a";\nexport const b = a;\n`,
  });
  assert.deepEqual(cycles, []);
});

test("findStaticCycles: DynamicImport の辺は数えない", () => {
  const tree = {
    a: [{ id: "b", kind: "StaticImport" }],
    b: [{ id: "a", kind: "DynamicImport" }],
    c: [{ id: "d", kind: "StaticImport" }],
    d: [{ id: "c", kind: "StaticExport" }],
    e: null,
  };
  assert.deepEqual(findStaticCycles(tree), [["c", "d"]]);
});

test("src に静的な値の import の輪が無い", async () => {
  const cycles = await scanCycles({
    context: process.cwd(),
    entries: ["src/**/*.ts", "src/**/*.tsx", "src/**/*.mts", "src/**/*.mjs"],
    tsconfig: path.join(process.cwd(), "tsconfig.json"),
  });
  const shown = cycles.map((files) => files.join(" <-> ")).join("\n");
  assert.deepEqual(cycles, [], `値の輪があります(型だけ・import() に書き換えたらコミットに理由を書く。src/lib/README.md):\n${shown}`);
});
