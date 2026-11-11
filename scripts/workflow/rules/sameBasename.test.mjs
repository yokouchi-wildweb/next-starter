// scripts/workflow/rules/sameBasename.test.mjs
// 1 つのフォルダに同じ名前の .ts と .tsx を置かない(tsc が .tsx を黙って飛ばすため)。実行: pnpm test scripts/workflow/rules/sameBasename.test.mjs
// 門 ship の pnpm check rules でも走る(./check.mjs)
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

import { repoFiles, sameBasenamePairs } from "./sameBasename.mjs";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "../../..");

test("読み手: 同じフォルダの <base>.ts と <base>.tsx を組として出す", () => {
  const pairs = sameBasenamePairs([
    "src/a/useX.test.ts",
    "src/a/useX.test.tsx",
    "scripts/b/run.ts",
    "scripts/b/run.tsx",
    "eslint-rules/c.ts",
    "eslint-rules/c.tsx",
  ]);
  assert.deepEqual(pairs, ["eslint-rules/c", "scripts/b/run", "src/a/useX.test"]);
});

test("読み手: 名前が違う・フォルダが違う・.d.ts・対象の外(servers/ など)は組にしない", () => {
  const pairs = sameBasenamePairs([
    "src/a/useX.test.ts",
    "src/a/useX.render.test.tsx",
    "src/a/Card.tsx",
    "src/b/Card.ts",
    "src/c/types.d.ts",
    "src/c/types.tsx",
    "servers/room/src/x.ts",
    "servers/room/src/x.tsx",
    "src/d/x.mts",
    "src/d/x.tsx",
  ]);
  assert.deepEqual(pairs, []);
});

test("今の repo: 同じフォルダに同じ名前の .ts と .tsx は無い(片方の名前を変える。例 <name>.render.test.tsx)", () => {
  const files = repoFiles(repoRoot).filter((file) => existsSync(join(repoRoot, file)));
  assert.deepEqual(sameBasenamePairs(files), [], "tsc は同じ名前の組の .tsx を読まない。片方の名前を変えてください");
});
