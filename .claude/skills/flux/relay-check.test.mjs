// /flux 中継判定スクリプト(relay-check.mjs)の契約テスト。
// 実行: pnpm test:flux-relay （node:test。一時ディレクトリに git リポジトリを作って再現する。追加依存なし）
//
// 再現する形: P(上流の直前の区切り)→ Q(この notice の区切り)を上流の履歴とし、
// Q の上に fork の既存の改変を積んだ commit を A(merge 直後の HEAD)とみなす。A からの未コミット変更 = この区間の適用作業。
import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync, readFileSync, renameSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

import { parseHunkRanges, rangesTouch, relayCheck } from "./relay-check.mjs";

const lines = (n, prefix = "line") => Array.from({ length: n }, (_, i) => `${prefix} ${i + 1}`).join("\n") + "\n";

function setupRepo() {
  const dir = mkdtempSync(join(tmpdir(), "relay-check-"));
  const run = (...args) =>
    execFileSync("git", ["-c", "user.name=t", "-c", "user.email=t@example.com", ...args], { cwd: dir, encoding: "utf8" }).trim();
  run("init", "-q");
  const write = (path, content) => {
    mkdirSync(dirname(join(dir, path)), { recursive: true });
    writeFileSync(join(dir, path), content);
  };
  const edit = (path, fn) => write(path, fn(readFileSync(join(dir, path), "utf8")));
  const commit = (msg) => {
    run("add", "-A");
    run("commit", "-q", "--allow-empty", "-m", msg);
    return run("rev-parse", "HEAD");
  };
  return { dir, run, write, edit, commit, cleanup: () => rmSync(dir, { recursive: true, force: true }) };
}

// 行 n を置き換える
const replaceLine = (n, text) => (content) => {
  const arr = content.split("\n");
  arr[n - 1] = text;
  return arr.join("\n");
};
// 行 n の直後に挿入する
const insertAfter = (n, text) => (content) => {
  const arr = content.split("\n");
  arr.splice(n, 0, text);
  return arr.join("\n");
};

test("parseHunkRanges: 行数 0 の側は境界に幅 0 の区間を置く", () => {
  const diff = "@@ -10,0 +11,2 @@\n+a\n+b\n@@ -20 +22 @@\n-x\n+y\n@@ -30,3 +31,0 @@\n";
  assert.deepEqual(parseHunkRanges(diff, "new"), [[11, 13], [22, 23], [32, 32]]);
  assert.deepEqual(parseHunkRanges(diff, "old"), [[11, 11], [20, 21], [30, 33]]);
});

test("rangesTouch: 重なり・接触は true、1 行でも離れれば false", () => {
  assert.equal(rangesTouch([1, 3], [3, 5]), true);
  assert.equal(rangesTouch([5, 5], [4, 5]), true);
  assert.equal(rangesTouch([5, 5], [5, 6]), true);
  assert.equal(rangesTouch([1, 3], [4, 6]), false);
});

test("同じファイルの離れた場所への fork の追加 → 中継不要", () => {
  const r = setupRepo();
  try {
    r.write("package.json", lines(40));
    const p = r.commit("P");
    r.edit("package.json", replaceLine(5, "upstream change"));
    const q = r.commit("Q");
    r.edit("package.json", insertAfter(30, "fork script"));
    const a = r.commit("A (fork baseline)");
    const result = relayCheck({ cwd: r.dir, p, q, appliedFrom: a });
    assert.equal(result.needed, false);
    assert.deepEqual(result.overlaps, []);
    assert.deepEqual(result.outside, []);
  } finally {
    r.cleanup();
  }
});

test("上流が変えた行を fork も変えている → 中継が必要(①)", () => {
  const r = setupRepo();
  try {
    r.write("src/config.ts", lines(20));
    const p = r.commit("P");
    r.edit("src/config.ts", replaceLine(10, "upstream value"));
    const q = r.commit("Q");
    r.edit("src/config.ts", replaceLine(10, "fork value"));
    const a = r.commit("A (conflict resolved to fork side)");
    const result = relayCheck({ cwd: r.dir, p, q, appliedFrom: a });
    assert.equal(result.needed, true);
    assert.deepEqual(result.overlaps.map((o) => o.path), ["src/config.ts"]);
  } finally {
    r.cleanup();
  }
});

test("上流の変更に接する行への fork の変更 → 中継が必要(①)", () => {
  const r = setupRepo();
  try {
    r.write("src/config.ts", lines(20));
    const p = r.commit("P");
    r.edit("src/config.ts", replaceLine(10, "upstream value"));
    const q = r.commit("Q");
    const a = r.commit("A");
    r.edit("src/config.ts", replaceLine(11, "fork value while applying"));
    const result = relayCheck({ cwd: r.dir, p, q, appliedFrom: a });
    assert.equal(result.needed, true);
    assert.deepEqual(result.overlaps.map((o) => o.path), ["src/config.ts"]);
  } finally {
    r.cleanup();
  }
});

test("適用作業で上流の変更ファイル外を改名 → 中継が必要(②)", () => {
  const r = setupRepo();
  try {
    r.write("src/core.ts", lines(5));
    r.write("src/features/namePool/index.ts", lines(5));
    const p = r.commit("P");
    r.edit("src/core.ts", replaceLine(2, "upstream"));
    const q = r.commit("Q");
    const a = r.commit("A");
    mkdirSync(join(r.dir, "src/features/namePoolEntry"), { recursive: true });
    renameSync(join(r.dir, "src/features/namePool/index.ts"), join(r.dir, "src/features/namePoolEntry/index.ts"));
    const result = relayCheck({ cwd: r.dir, p, q, appliedFrom: a });
    assert.equal(result.needed, true);
    assert.deepEqual(result.overlaps, []);
    assert.deepEqual(result.outside, ["src/features/namePool/index.ts", "src/features/namePoolEntry/index.ts"]);
  } finally {
    r.cleanup();
  }
});

test("fork の既存の改変が上流の変更ファイル外にあるだけ → 中継不要", () => {
  const r = setupRepo();
  try {
    r.write("src/core.ts", lines(5));
    r.write("src/registry/domainConfigRegistry.ts", lines(5));
    const p = r.commit("P");
    r.edit("src/core.ts", replaceLine(2, "upstream"));
    const q = r.commit("Q");
    r.edit("src/registry/domainConfigRegistry.ts", insertAfter(5, "fork entry"));
    const a = r.commit("A (fork baseline)");
    assert.equal(relayCheck({ cwd: r.dir, p, q, appliedFrom: a }).needed, false);
  } finally {
    r.cleanup();
  }
});

test("lock ファイルと .notices/ だけの差分 → 中継不要", () => {
  const r = setupRepo();
  try {
    r.write("pnpm-lock.yaml", lines(10));
    r.write("src/core.ts", lines(5));
    const p = r.commit("P");
    r.edit("pnpm-lock.yaml", replaceLine(3, "upstream dep"));
    r.write(".notices/20260101-000000-x.md", "notice\n");
    const q = r.commit("Q");
    r.edit("pnpm-lock.yaml", replaceLine(3, "fork dep"));
    const a = r.commit("A");
    r.write(".notices/applied/fork.md", "- id:x\n");
    const result = relayCheck({ cwd: r.dir, p, q, appliedFrom: a });
    assert.equal(result.needed, false);
  } finally {
    r.cleanup();
  }
});

test("上流が削除したファイルを fork が残している → 中継が必要(①、ファイル全体)", () => {
  const r = setupRepo();
  try {
    r.write("src/old.ts", lines(5));
    const p = r.commit("P");
    r.run("rm", "-q", "src/old.ts");
    const q = r.commit("Q");
    r.write("src/old.ts", lines(6));
    const a = r.commit("A (fork kept the file)");
    const result = relayCheck({ cwd: r.dir, p, q, appliedFrom: a });
    assert.equal(result.needed, true);
    assert.deepEqual(result.overlaps, [{ path: "src/old.ts", upstream: "whole", fork: "whole" }]);
  } finally {
    r.cleanup();
  }
});

test("上流と同じ内容で揃っている → 中継不要", () => {
  const r = setupRepo();
  try {
    r.write("src/core.ts", lines(5));
    const p = r.commit("P");
    r.edit("src/core.ts", replaceLine(2, "upstream"));
    r.write("src/new.ts", lines(3));
    const q = r.commit("Q");
    const result = relayCheck({ cwd: r.dir, p, q, appliedFrom: q });
    assert.equal(result.needed, false);
  } finally {
    r.cleanup();
  }
});
