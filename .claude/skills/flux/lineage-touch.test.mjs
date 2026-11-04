// /flux の打ち消し接触の判定スクリプト(lineage-touch.mjs)の契約テスト。
// 実行: pnpm test:flux-relay （node:test。一時ディレクトリに git リポジトリを作り、取り込む前後の 2 版を commit で再現する）
import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { lineageTouch } from "./lineage-touch.mjs";

const SCRIPT = join(dirname(fileURLToPath(import.meta.url)), "lineage-touch.mjs");
const PREAMBLE = "# lineage\n<!-- end preamble -->\n";
const midSection = (tone) => `## mid\n- tone (default): ${tone}\n- relay: always\n<!-- end mid -->\n`;

function setup() {
  const dir = mkdtempSync(join(tmpdir(), "lineage-touch-"));
  const run = (...args) => execFileSync("git", ["-c", "user.name=t", "-c", "user.email=t@example.com", ...args], { cwd: dir, encoding: "utf8" }).trim();
  const write = (path, text) => {
    mkdirSync(dirname(join(dir, path)), { recursive: true });
    writeFileSync(join(dir, path), text);
  };
  const commit = (message) => {
    run("add", "-A");
    run("commit", "-q", "-m", message);
    return run("rev-parse", "HEAD");
  };
  run("init", "-q");
  write(".claude/rules/project.md", "## TIER\nfork_id: leaf\ndownstream: none\noverrides: mid.tone = casual | why: 若年層向け\n");
  return { dir, write, commit, cleanup: () => rmSync(dir, { recursive: true, force: true }) };
}

test("lineageTouch: 名指す鍵が変わった区間は touched、他の鍵だけなら none。CLI は 1 / 0 / 2", () => {
  const repo = setup();
  try {
    repo.write(".claude/rules/lineage.md", PREAMBLE + midSection("polite"));
    const before = repo.commit("before");
    repo.write(".claude/rules/lineage.md", PREAMBLE + midSection("polite").replace("always", "never"));
    const otherKey = repo.commit("other key");
    repo.write(".claude/rules/lineage.md", PREAMBLE + midSection("formal").replace("always", "never"));
    const touchedRef = repo.commit("touch tone");

    assert.deepEqual(lineageTouch({ cwd: repo.dir, before, after: otherKey }).touched, []);
    const touched = lineageTouch({ cwd: repo.dir, before, after: touchedRef }).touched;
    assert.deepEqual(touched.map((t) => `${t.target}:${t.change}`), ["mid.tone:changed"]);

    const cli = (...args) => spawnSync(process.execPath, [SCRIPT, ...args], { cwd: repo.dir, encoding: "utf8" });
    assert.equal(cli("--before", before, "--after", otherKey).status, 0);
    const hit = cli("--before", before, "--after", touchedRef);
    assert.equal(hit.status, 1);
    assert.match(hit.stdout, /touched: mid\.tone \(changed\)/);
    assert.equal(cli("--before", before, "--after", "no-such-ref").status, 2);
    assert.equal(cli("--before", before).status, 2);
  } finally {
    repo.cleanup();
  }
});

test("lineageTouch: lineage.md の無い版(取り込む前)からは触れない扱い", () => {
  const repo = setup();
  try {
    const before = repo.commit("no lineage");
    repo.write(".claude/rules/lineage.md", PREAMBLE + midSection("polite"));
    const after = repo.commit("lineage arrives");
    assert.deepEqual(lineageTouch({ cwd: repo.dir, before, after }).touched, []);
  } finally {
    repo.cleanup();
  }
});
