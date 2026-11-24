// scripts/workflow/repo-paths/repoPaths.test.mjs — リポの名を付けたパスの判定。実行: pnpm test scripts/workflow/repo-paths/repoPaths.test.mjs
import assert from "node:assert/strict";
import { test } from "node:test";

import { carriesRepoName, repoNamedProblems } from "./lib.mjs";

const ID = "next-starter";

test("記録の所(台帳・一時許可・日付の記録)は通る", () => {
  assert.deepEqual(
    repoNamedProblems([".notices/applied/next-starter.md", ".fork-ownership/next-starter.permits.txt", "docs/journal/2026-11-20--next-starter--x.md", "src/lib/crud/index.ts"], [ID]),
    [],
  );
});

test("記録の所の外のリポの名のファイル・フォルダは止める", () => {
  const paths = [".backends/next-starter.json", "src/x/next-starter.ts", "src/x/config.next-starter.ts", "next-starter/a.ts", "docs/journal/next-starter.md", ".notices/applied/next-starter.txt"];
  assert.deepEqual(repoNamedProblems(paths, [ID]).map((p) => p.path), paths);
});

test("名の一部だけ当たる物は名と見ない", () => {
  for (const path of ["src/next-starter-kit/a.ts", "docs/my-next-starter.md", "src/nextstarter.ts"]) assert.equal(carriesRepoName(path, ID), false, path);
});
