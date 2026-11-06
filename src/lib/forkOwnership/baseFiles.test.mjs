// 基準の版のファイル一覧のテスト。実行: pnpm test:fork-ownership (node:test、一時フォルダの git リポ)
import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { lastUpstreamSha, readBaseFiles } from "./baseFiles.mjs";

const git = (root, ...args) => execFileSync("git", args, { cwd: root, encoding: "utf8" }).trim();

function repo() {
  const root = mkdtempSync(join(tmpdir(), "base-files-"));
  git(root, "init", "-q");
  git(root, "config", "user.email", "t@example.com");
  git(root, "config", "user.name", "t");
  mkdirSync(join(root, "src"), { recursive: true });
  writeFileSync(join(root, "src/a.ts"), "export const a = 1;\n");
  git(root, "add", ".");
  git(root, "commit", "-q", "-m", "base");
  return { root, sha: git(root, "rev-parse", "HEAD") };
}

test("readBaseFiles: 台帳の最後の upstream:<sha> の版のファイル一覧", () => {
  const { root, sha } = repo();
  mkdirSync(join(root, ".claude/rules"), { recursive: true });
  writeFileSync(join(root, ".claude/rules/project.md"), "## TIER\nfork_id: acme\ndownstream: none\n");
  mkdirSync(join(root, ".notices/applied"), { recursive: true });
  writeFileSync(join(root, ".notices/applied/acme.md"), `- id:x | upstream:0000000\n- id:y | upstream:${sha}\n`);
  writeFileSync(join(root, "src/b.ts"), "export const b = 1;\n");
  git(root, "add", ".");
  git(root, "commit", "-q", "-m", "fork");
  assert.deepEqual(readBaseFiles(root, null), { rev: sha, files: ["src/a.ts"] });
});

test("readBaseFiles: base を渡せば台帳を見ない / 決まらない・読めない版は problem", () => {
  const { root, sha } = repo();
  assert.deepEqual(readBaseFiles(root, sha), { rev: sha, files: ["src/a.ts"] });
  assert.match(readBaseFiles(root, null).problem, /基準の版が決まらない/);
  assert.match(readBaseFiles(root, "deadbeef").problem, /読めない/);
});

test("lastUpstreamSha: 入口から check.mjs と同じ関数", () => {
  assert.equal(lastUpstreamSha("- id:a | upstream:abc1234\n- id:b | upstream:def5678\n"), "def5678");
  assert.equal(lastUpstreamSha(""), null);
});
