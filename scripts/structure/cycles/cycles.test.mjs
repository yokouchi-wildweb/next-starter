// scripts/structure/cycles/cycles.test.mjs
// src 全体に静的な値の import の輪が無いこと(D24・D25)、型の import も数えた単位と lib の輪が無いこと(D232)と、判定の契約。
// 実行: pnpm test scripts/structure/cycles/cycles.test.mjs(build の冒頭の門 check --gate=build でも走る)

import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";

import { findStaticCycles, findUnitCycles, scanCycles, scanUnitCycles } from "./cycles.mjs";

const TSCONFIG = JSON.stringify({ compilerOptions: { baseUrl: ".", moduleResolution: "bundler", module: "esnext", paths: { "@/*": ["./src/*"] } } });

const withFixture = async (files, run) => {
  const dir = mkdtempSync(path.join(tmpdir(), "cycles-"));
  try {
    for (const [name, code] of Object.entries(files)) {
      mkdirSync(path.dirname(path.join(dir, name)), { recursive: true });
      writeFileSync(path.join(dir, name), code);
    }
    return await run(dir);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
};
const fixture = (files) => withFixture(files, (dir) => scanCycles({ context: dir, entries: ["src/**/*.ts"] }));
const unitFixture = (files) =>
  withFixture({ "tsconfig.json": TSCONFIG, ...files }, (dir) =>
    scanUnitCycles({ context: dir, entries: ["src/**/*.ts", "src/**/*.tsx"], tsconfig: path.join(dir, "tsconfig.json") }),
  );

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

test("別名(tsconfig の paths)の import も辺に数える(tsconfig を絶対パスで渡しても)", async () => {
  const cycles = await withFixture(
    {
      "tsconfig.json": TSCONFIG,
      "src/lib/a/index.ts": `import { b } from "@/lib/b";\nexport const a = () => b;\n`,
      "src/lib/b/index.ts": `import { a } from "@/lib/a";\nexport const b = () => a;\n`,
    },
    (dir) => scanCycles({ context: dir, entries: ["src/**/*.ts"], tsconfig: path.join(dir, "tsconfig.json") }),
  );
  assert.deepEqual(cycles, [["src/lib/a/index.ts", "src/lib/b/index.ts"]]);
});

test("単位と lib の輪: 型だけの lib どうしの輪を見つけ、輪の中の辺を出す", async () => {
  const cycles = await unitFixture({
    "src/lib/a/index.ts": `import type { B } from "@/lib/b";\nexport type A = { b: B };\n`,
    "src/lib/b/index.ts": `import type { A } from "@/lib/a";\nexport type B = { a?: A };\n`,
  });
  assert.deepEqual(cycles, [{ units: ["src/lib/a", "src/lib/b"], edges: ["src/lib/a/index.ts -> src/lib/b/index.ts", "src/lib/b/index.ts -> src/lib/a/index.ts"] }]);
});

test("単位と lib の輪: lib → 棚の単位 → lib の型の輪も見つける、import() も辺に数える", async () => {
  const cycles = await unitFixture({
    "src/lib/data/index.ts": `export const load = () => import("@/components/Input/Picker");\nexport type Params = { q?: string };\n`,
    "src/components/Input/Picker.tsx": `import type { Params } from "@/lib/data";\nexport const Picker = (p: Params) => p;\n`,
    "src/components/Input/Other.tsx": `export const Other = 1;\n`,
  });
  assert.deepEqual(cycles.map((c) => c.units), [["src/components/Input/Picker", "src/lib/data"]]);
});

test("単位と lib の輪: 1 つの単位の中の輪・まとめない場所(features)・テストのファイルは数えない", async () => {
  const cycles = await unitFixture({
    "src/lib/a/index.ts": `import { x } from "./x";\nexport const a = x;\n`,
    "src/lib/a/x.ts": `import { a } from "./index";\nexport const x = () => a;\n`,
    "src/components/Input/Select/index.tsx": `import { Part } from "./Part";\nexport const Select = Part;\n`,
    "src/components/Input/Select/Part.tsx": `import type { Select } from "./index";\nexport const Part = 1 as unknown as typeof Select;\n`,
    "src/lib/b/index.ts": `import type { F } from "@/features/f/types";\nexport type B = F;\n`,
    "src/features/f/types.ts": `import type { B } from "@/lib/b";\nexport type F = { b?: B };\n`,
    "src/lib/c/index.ts": `export const c = 1;\n`,
    "src/lib/c/c.test.ts": `import { a } from "@/lib/a";\nexport const t = a;\n`,
    "src/lib/a/a.test.ts": `import { c } from "@/lib/c";\nexport const t = c;\n`,
  });
  assert.deepEqual(cycles, []);
});

test("findUnitCycles: まとめた単位の図の輪だけ(同じ単位の中の辺・null の辺は数えない)", () => {
  const tree = {
    "src/lib/a/x.ts": [{ id: "src/lib/b/y.ts" }, { id: "src/lib/a/z.ts" }, { id: null }],
    "src/lib/b/y.ts": [{ id: "src/lib/a/z.ts" }],
    "src/lib/a/z.ts": [],
  };
  const unitOf = (f) => f.split("/").slice(0, 3).join("/");
  assert.deepEqual(findUnitCycles(tree, unitOf), [{ units: ["src/lib/a", "src/lib/b"], edges: ["src/lib/a/x.ts -> src/lib/b/y.ts", "src/lib/b/y.ts -> src/lib/a/z.ts"] }]);
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

test("src に型の import も数えた単位と lib の輪が無い", async () => {
  const cycles = await scanUnitCycles({
    context: process.cwd(),
    entries: ["src/**/*.ts", "src/**/*.tsx", "src/**/*.mts", "src/**/*.mjs"],
    tsconfig: path.join(process.cwd(), "tsconfig.json"),
  });
  const shown = cycles.map(({ units, edges }) => `${units.join(" <-> ")}\n  ${edges.join("\n  ")}`).join("\n");
  assert.deepEqual(cycles, [], `単位と lib の輪があります(型も数える。共有の型はそれを持つ側へ移す: scripts/README.md):\n${shown}`);
});
