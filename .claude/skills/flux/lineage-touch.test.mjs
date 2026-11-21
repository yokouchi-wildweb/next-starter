// /flux の打ち消し接触の判定スクリプト(lineage-touch.mjs)の契約テスト。
// 実行: pnpm test .claude/skills/flux/lineage-touch.test.mjs （node:test。一時ディレクトリに git リポジトリを作り、取り込む前後の 2 版を commit で再現する）
import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { importedFiles } from "../../../scripts/runner/test/lib.copyByImports.mjs";
import { lineageTouch } from "./lineage-touch.mjs";

const SCRIPT = join(dirname(fileURLToPath(import.meta.url)), "lineage-touch.mjs");
const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), "../../..");
// lineage-touch.mjs が道を組み立てて読む 2 本(import の道からは見えないので入口として挙げる)。そこから届くコードは importedFiles で
const LIB_ENTRIES = ["src/lib/forkOwnership/forkIds.mjs", "src/lib/forkOwnership/lineage.mjs"];
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
  run("init", "-q", "-b", "main");
  write("repo.json", '{"repo_id": "leaf", "tier": "leaf"}\n');
  write(".claude/rules/project.md", "## TIER\noverrides: mid.tone = casual | why: 若年層向け\n");
  return { dir, run, write, commit, cleanup: () => rmSync(dir, { recursive: true, force: true }) };
}

test("lineageTouch: 名指す鍵が変わった区間は touched、他の鍵だけなら none。CLI は 1 / 0 / 2", async () => {
  const repo = setup();
  try {
    repo.write(".claude/rules/lineage.md", PREAMBLE + midSection("polite"));
    const before = repo.commit("before");
    repo.write(".claude/rules/lineage.md", PREAMBLE + midSection("polite").replace("always", "never"));
    const otherKey = repo.commit("other key");
    repo.write(".claude/rules/lineage.md", PREAMBLE + midSection("formal").replace("always", "never"));
    const touchedRef = repo.commit("touch tone");

    assert.deepEqual((await lineageTouch({ cwd: repo.dir, before, after: otherKey })).touched, []);
    const touched = (await lineageTouch({ cwd: repo.dir, before, after: touchedRef })).touched;
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

test("lineageTouch: lineage.md の無い版(取り込む前)からは触れない扱い", async () => {
  const repo = setup();
  try {
    const before = repo.commit("no lineage");
    repo.write(".claude/rules/lineage.md", PREAMBLE + midSection("polite"));
    const after = repo.commit("lineage arrives");
    assert.deepEqual((await lineageTouch({ cwd: repo.dir, before, after })).touched, []);
  } finally {
    repo.cleanup();
  }
});

test("古い fork: 作業ツリーに判定の lib が無くても、上流の先端版を .flux/ に出して --upstream の版の lib で判定する", async () => {
  const repo = setup();
  try {
    repo.write(".claude/rules/lineage.md", PREAMBLE + midSection("polite"));
    const before = repo.commit("old fork: no lib");
    // 上流の線: lib が入り、名指す鍵が変わる(fork の作業ツリーは before のまま = lib が無い)
    repo.run("checkout", "-q", "-b", "upstream");
    for (const rel of await importedFiles(REPO_ROOT, LIB_ENTRIES)) repo.write(rel, readFileSync(join(REPO_ROOT, rel), "utf8"));
    mkdirSync(join(repo.dir, ".claude/skills/flux"), { recursive: true });
    copyFileSync(SCRIPT, join(repo.dir, ".claude/skills/flux/lineage-touch.mjs"));
    repo.write(".claude/rules/lineage.md", PREAMBLE + midSection("formal"));
    const tip = repo.commit("upstream tip");
    repo.run("checkout", "-q", "main");

    // SKILL.md 5a の打ち方: 先端版を .flux/ に取り出して回す
    mkdirSync(join(repo.dir, ".flux"), { recursive: true });
    writeFileSync(join(repo.dir, ".flux/lineage-touch.mjs"), repo.run("show", `${tip}:.claude/skills/flux/lineage-touch.mjs`) + "\n");
    const cli = (...args) => spawnSync(process.execPath, [".flux/lineage-touch.mjs", ...args], { cwd: repo.dir, encoding: "utf8" });
    const hit = cli("--upstream=upstream", "--before", before, "--after", tip);
    assert.equal(hit.status, 1, hit.stderr);
    assert.match(hit.stdout, /touched: mid\.tone \(changed\)/);
    assert.equal(cli("--upstream=upstream", "--before", before, "--after", before).status, 0);
    assert.equal(cli("--before", before, "--after", tip).status, 2); // --upstream 無しでは隣の lib が無い = 読めない
  } finally {
    repo.cleanup();
  }
});

test("古い fork: repo.json も lineage.md も overrides も無ければ触れる物が無いので 0、overrides があって名前が読めなければ 2", () => {
  const dir = mkdtempSync(join(tmpdir(), "lineage-touch-norepo-"));
  const run = (...args) => execFileSync("git", ["-c", "user.name=t", "-c", "user.email=t@example.com", ...args], { cwd: dir, encoding: "utf8" }).trim();
  try {
    run("init", "-q", "-b", "main");
    writeFileSync(join(dir, "README.md"), "old fork\n");
    run("add", "-A");
    run("commit", "-q", "-m", "old fork: no repo.json");
    const head = run("rev-parse", "HEAD");
    const cli = (...args) => spawnSync(process.execPath, [SCRIPT, ...args], { cwd: dir, encoding: "utf8" });
    const none = cli("--before", head, "--after", head);
    assert.equal(none.status, 0, none.stderr);
    assert.match(none.stdout, /result: none/);
    mkdirSync(join(dir, ".claude/rules"), { recursive: true });
    writeFileSync(join(dir, ".claude/rules/project.md"), "## TIER\noverrides: mid.tone = casual | why: x\n");
    assert.equal(cli("--before", head, "--after", head).status, 2);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
