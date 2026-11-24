// scripts/operations/deploy/lib.test.ts — pnpm test scripts/operations/deploy
// 本番のデプロイのセーフポイントの止め: --allow-unsafe=<理由> の読み方と guardSafePoint の分かれ方(判定は差し替える。vercel は触らない)
// と、上げる木の書き出し exportCommitTree(一時の git の repo で: HEAD の中身とリンクだけ、.env*・未追跡・未 commit は入らない)

import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";

import { exportCommitTree, guardSafePoint, parseAllowUnsafe } from "./lib";

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

test("parseAllowUnsafe: 無ければ null、理由は取り出して他の引数は順に残す、旗だけ・空の理由は error", () => {
  assert.deepEqual(parseAllowUnsafe(["--prod"]), { reason: null, rest: ["--prod"], error: null });
  assert.deepEqual(parseAllowUnsafe(["--target=preview", "--allow-unsafe=急ぎ", "--confirm=production"]), {
    reason: "急ぎ",
    rest: ["--target=preview", "--confirm=production"],
    error: null,
  });
  assert.match(parseAllowUnsafe(["--allow-unsafe"]).error ?? "", /理由が空/);
  assert.match(parseAllowUnsafe(["--allow-unsafe=  "]).error ?? "", /理由が空/);
});

function harness(verdict: { ok: boolean; line: string; message: string }) {
  const calls = { verdict: 0, logs: [] as string[], errors: [] as string[], exits: [] as number[] };
  const deps = {
    verdict: () => {
      calls.verdict += 1;
      return verdict;
    },
    log: (s: string) => calls.logs.push(s),
    error: (s: string) => calls.errors.push(s),
    exit: ((code: number) => {
      calls.exits.push(code);
    }) as (code: number) => never,
  };
  return { calls, deps };
}

test("guardSafePoint: プレビューは判定しない、ok は通す、外れて理由なしは exit(1)、理由があれば理由を出して通す", () => {
  const bad = { ok: false, line: "before safe/next-starter/20261110-1", message: "本番に出せません: 違う" };

  const preview = harness(bad);
  guardSafePoint(false, null, preview.deps);
  assert.equal(preview.calls.verdict, 0);

  const ok = harness({ ok: true, line: "at safe/next-starter/20261110-1", message: "セーフポイント safe/next-starter/20261110-1 の上にいます" });
  guardSafePoint(true, null, ok.deps);
  assert.deepEqual(ok.calls.exits, []);
  assert.deepEqual(ok.calls.logs, ["✓ セーフポイント safe/next-starter/20261110-1 の上にいます"]);

  const refused = harness(bad);
  guardSafePoint(true, null, refused.deps);
  assert.deepEqual(refused.calls.exits, [1]);
  assert.deepEqual(refused.calls.errors, ["✗ 本番に出せません: 違う"]);

  const allowed = harness(bad);
  guardSafePoint(true, "急ぎ", allowed.deps);
  assert.deepEqual(allowed.calls.exits, []);
  assert.match(allowed.calls.errors.join("\n"), /--allow-unsafe\): 急ぎ/);
  assert.match(allowed.calls.errors.join("\n"), /本番に出せません: 違う/);
});
