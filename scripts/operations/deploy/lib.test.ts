// scripts/operations/deploy/lib.test.ts — pnpm test scripts/operations/deploy
// 本番のデプロイのセーフポイントの知らせ: reportSafePoint の分かれ方(判定は差し替える。止めない、D317。vercel は触らない)
// と、上げる木の書き出し exportCommitTree(一時の git の repo で: HEAD の中身とリンクだけ、.env*・未追跡・未 commit は入らない)

import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";

import { exportCommitTree, reportSafePoint } from "./lib";

test("exportCommitTree: HEAD の中身とリンク(.vercel/project.json)だけを書き出し、.env*・未追跡・未 commit の変更は入らない", () => {
  const repo = mkdtempSync(path.join(tmpdir(), "deploy-repo-"));
  const git = (...args: string[]) => execFileSync("git", args, { cwd: repo, encoding: "utf8" });
  let dir = "";
  try {
    git("init", "-q");
    git("config", "user.email", "t@example.test");
    git("config", "user.name", "t");
    writeFileSync(path.join(repo, ".gitignore"), ".env*\n!.env.example\n.vercel\n");
    writeFileSync(path.join(repo, ".env.example"), "A=\n");
    mkdirSync(path.join(repo, "src"));
    writeFileSync(path.join(repo, "src", "a.ts"), "export const a = 1;\n");
    git("add", "-A");
    git("commit", "-q", "-m", "init");
    writeFileSync(path.join(repo, ".env.production"), "SECRET=x\n");
    writeFileSync(path.join(repo, "untracked.txt"), "u\n");
    writeFileSync(path.join(repo, "src", "a.ts"), "export const a = 2;\n");
    mkdirSync(path.join(repo, ".vercel"));
    writeFileSync(path.join(repo, ".vercel", "project.json"), '{"projectId":"p"}');
    const tree = exportCommitTree(repo);
    dir = tree.dir;
    assert.equal(tree.commit, git("rev-parse", "--short", "HEAD").trim());
    assert.equal(readFileSync(path.join(dir, "src", "a.ts"), "utf8"), "export const a = 1;\n", "commit の中身(未 commit の変更は入らない)");
    assert.ok(existsSync(path.join(dir, ".env.example")), "追跡している .env.example は入る");
    assert.ok(!existsSync(path.join(dir, ".env.production")), ".env.production は入らない");
    assert.ok(!existsSync(path.join(dir, "untracked.txt")), "未追跡は入らない");
    assert.ok(!existsSync(path.join(dir, ".archive.tar")), "書き出しの tar は残らない");
    assert.equal(readFileSync(path.join(dir, ".vercel", "project.json"), "utf8"), '{"projectId":"p"}', "リンクだけ写す");
  } finally {
    rmSync(repo, { recursive: true, force: true });
    if (dir) rmSync(dir, { recursive: true, force: true });
  }
});

function harness(position: { ok: boolean; line: string; message: string }) {
  const calls = { position: 0, logs: [] as string[] };
  const deps = {
    position: () => {
      calls.position += 1;
      return position;
    },
    log: (s: string) => calls.logs.push(s),
  };
  return { calls, deps };
}

test("reportSafePoint: プレビューは見ない、上なら ✓、外なら ℹ の 1 行で止めない(D317)", () => {
  const off = { ok: false, line: "before safe/next-starter/20261110-1", message: "HEAD abc はセーフポイントではありません" };

  const preview = harness(off);
  reportSafePoint(false, preview.deps);
  assert.equal(preview.calls.position, 0);
  assert.deepEqual(preview.calls.logs, []);

  const on = harness({ ok: true, line: "at safe/next-starter/20261110-1", message: "セーフポイント safe/next-starter/20261110-1 の上にいます" });
  reportSafePoint(true, on.deps);
  assert.deepEqual(on.calls.logs, ["✓ セーフポイント safe/next-starter/20261110-1 の上にいます"]);

  const outside = harness(off);
  reportSafePoint(true, outside.deps);
  assert.deepEqual(outside.calls.logs, ["ℹ HEAD abc はセーフポイントではありません"]);
});
