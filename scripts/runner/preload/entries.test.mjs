// scripts/runner/preload/entries.test.mjs
// 実行: pnpm test scripts/runner/preload/entries.test.mjs

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { test } from "node:test";

import { findMissingStubs, readEntries, scanTree, serverOnlyPath } from "./entries.mjs";

const tree = {
  "scripts/a.ts": [{ request: "./b", id: "src/b.ts", kind: "StaticImport" }],
  "src/b.ts": [{ request: "./c", id: "src/c.ts", kind: "DynamicImport" }],
  "src/c.ts": [{ request: "server-only", id: null, kind: "StaticImport" }],
  "scripts/plain.ts": [{ request: "./d", id: "src/d.ts", kind: "StaticImport" }],
  "src/d.ts": [],
};

test("readEntries: tsx の入口だけ、stub の有無、複数のファイル", () => {
  const entries = readEntries({
    a: "cross-env X=1 npx tsx scripts/a.ts --all",
    b: "npx tsx --import ./scripts/runner/preload/serverOnly.mjs --test src/x.test.ts src/y.test.mts",
    c: "node --test scripts/c.test.mjs",
  });
  assert.deepEqual(entries, [
    { name: "a", stub: false, files: ["scripts/a.ts"] },
    { name: "b", stub: true, files: ["src/x.test.ts", "src/y.test.mts"] },
  ]);
});

test("serverOnlyPath: import() の辺も辿り、届かなければ null", () => {
  assert.deepEqual(serverOnlyPath(tree, "scripts/a.ts"), ["scripts/a.ts", "src/b.ts", "src/c.ts"]);
  assert.equal(serverOnlyPath(tree, "scripts/plain.ts"), null);
});

test("findMissingStubs: 届く + stub なしだけ失敗", () => {
  const entries = [
    { name: "reach-no-stub", stub: false, files: ["scripts/a.ts"] },
    { name: "reach-stub", stub: true, files: ["scripts/a.ts"] },
    { name: "no-reach", stub: false, files: ["scripts/plain.ts"] },
  ];
  assert.deepEqual(findMissingStubs(entries, tree).map((problem) => problem.name), ["reach-no-stub"]);
});

test("package.json の入口: server-only に届くものは stub を読む", async () => {
  const entries = readEntries(JSON.parse(readFileSync("package.json", "utf8")).scripts);
  const files = [...new Set(entries.flatMap((entry) => entry.files))];
  const scanned = await scanTree(files, path.join(process.cwd(), "tsconfig.json"));
  const problems = findMissingStubs(entries, scanned);
  assert.deepEqual(
    problems,
    [],
    problems.map(({ name, path: chain }) => `${name}: ${chain.join(" > ")} > server-only`).join("\n"),
  );
});

test("門と道具の入口: ランナーが .ts の入口に必ず stub を付ける(pnpm check / generate・pnpm ops / workflow)", async () => {
  const { command } = await import("../gates/run.mjs");
  const [cmd, args] = command(process.cwd(), "scripts/structure/routes/check.ts", false);
  assert.equal(cmd, "npx");
  assert.ok(args.includes("./scripts/runner/preload/serverOnly.mjs"), args.join(" "));
  const { run } = await import("../entries/run.mjs");
  const spawned = [];
  for (const argv of [["operations", "db", "seed"], ["workflow", "dev-tab", "run"]]) {
    run(argv, { log: () => {}, spawn: (c, a) => (spawned.push([c, ...a]), 0) });
  }
  for (const line of spawned) assert.ok(line.includes("./scripts/runner/preload/serverOnly.mjs"), line.join(" "));
  assert.equal(spawned.length, 2);
});
