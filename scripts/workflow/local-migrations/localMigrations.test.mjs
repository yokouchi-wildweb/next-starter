// scripts/workflow/local-migrations/localMigrations.test.mjs — pnpm test scripts/workflow/local-migrations
// 追跡・ステージされた .local.ts を見つけること(一時のリポジトリ)と、上流の .gitignore が .local.ts を外すこと。
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { test } from "node:test";

import { trackedLocalMigrations } from "./lib.tracked.mjs";

const repoRoot = join(import.meta.dirname, "../../..");
const git = (cwd, ...args) => execFileSync("git", args, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });

test("ステージした .local.ts とコミットした .local.ts を出し、ふつうの移行と追跡していない .local.ts は出さない", () => {
  const root = mkdtempSync(join(tmpdir(), "local-mig-"));
  try {
    git(root, "init", "-q");
    const put = (path) => {
      mkdirSync(dirname(join(root, path)), { recursive: true });
      writeFileSync(join(root, path), "export {};\n");
    };
    for (const p of ["src/features/core/a/scripts/migrations/x.local.ts", "src/features/b/scripts/migrations/y.local.ts", "src/features/b/scripts/migrations/z.ts", "src/features/b/scripts/migrations/w.local.ts"]) put(p);
    git(root, "add", "src/features/core/a/scripts/migrations/x.local.ts", "src/features/b/scripts/migrations/z.ts");
    git(root, "-c", "user.email=t@example.test", "-c", "user.name=t", "commit", "-q", "-m", "c");
    git(root, "add", "src/features/b/scripts/migrations/y.local.ts");
    assert.deepEqual(trackedLocalMigrations(root), ["src/features/b/scripts/migrations/y.local.ts", "src/features/core/a/scripts/migrations/x.local.ts"]);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("上流の .gitignore が git に入れない移行を外す(ふつうの移行は外さない)", () => {
  assert.match(git(repoRoot, "check-ignore", "-v", "src/features/core/setting/scripts/migrations/x.local.ts"), /\.gitignore:\d+:src\/features\/\*\*\/scripts\/migrations\/\*\.local\.ts/);
  assert.throws(() => git(repoRoot, "check-ignore", "src/features/core/setting/scripts/migrations/x.ts"));
});

test("このリポジトリは .local.ts を追跡していない", () => {
  assert.deepEqual(trackedLocalMigrations(repoRoot), []);
});
