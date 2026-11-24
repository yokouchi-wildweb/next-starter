// scripts/workflow/notices/ledger.test.mjs — pnpm workflow notices ledger(/flux の台帳の行を足す道具)
import assert from "node:assert/strict";
import { existsSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { after, before, describe, test } from "node:test";
import { closeTmp, commitAll, FORK_ID, git, lastUpstreamSha, makeFork, makeParent, openTmp, repoJson, write } from "../../../src/lib/forkOwnership/node.mjs";
import { run, tailId } from "./ledger.mjs";

const LEDGER = `.notices/applied/${FORK_ID}.md`;
const NOW = { now: () => new Date("2026-11-25T01:02:03.456Z") };
const read = (fork) => readFileSync(join(fork, LEDGER), "utf8");

/** 親に 1 commit 足して fork へ fetch(merge 先) → { fork, target } */
function forkWithTarget({ tier = "middle" } = {}) {
  const parent = makeParent();
  const fork = makeFork(parent);
  if (tier !== "middle") {
    write(fork, "repo.json", repoJson(FORK_ID, tier));
    commitAll(fork, "tier");
  }
  write(parent, "src/lib/crud/index.ts", "export const crud = 2;\n");
  commitAll(parent, "departure merge stand-in");
  git(fork, "fetch", "-q", "upstream");
  return { fork, target: git(fork, "rev-parse", "upstream/main").trim() };
}

const runLog = (fork, argv) => {
  const lines = [];
  const code = run(fork, argv, (line) => lines.push(line), NOW);
  return { code, out: lines.join("\n") };
};

describe("pnpm workflow notices ledger", () => {
  before(() => {
    openTmp();
  });
  after(() => {
    closeTmp();
  });

  test("--id: notice 1 つにつき 1 行、upstream: は完全な sha、下流を持つ fork は relay:", () => {
    const { fork, target } = forkWithTarget();
    const { code } = runLog(fork, ["--upstream=upstream/main", "--id=20261125-000000-a", "--id=20261125-000001-b", "--commit=abc1234", "--relay=none"]);
    assert.equal(code, 0);
    const lines = read(fork).trimEnd().split("\n").slice(-2);
    assert.deepEqual(lines, [
      `- id:20261125-000000-a | date:2026-11-25T01:02:03Z | commit:abc1234 | upstream:${target} | relay:none | notes:-`,
      `- id:20261125-000001-b | date:2026-11-25T01:02:03Z | commit:abc1234 | upstream:${target} | relay:none | notes:-`,
    ]);
  });

  test("--tail: notice の無い末尾の区間に tail-<sha9> の 1 行、最後の upstream: が merge 先になる", () => {
    const { fork, target } = forkWithTarget();
    const { code } = runLog(fork, ["--upstream=upstream/main", "--tail", "--notes=merge-only tail segment"]);
    assert.equal(code, 0);
    assert.equal(read(fork).trimEnd().split("\n").at(-1), `- id:${tailId(target)} | date:2026-11-25T01:02:03Z | commit:- | upstream:${target} | relay:none | notes:merge-only tail segment`);
    assert.equal(lastUpstreamSha(read(fork)), target);
  });

  test("--tail: 手で足した末尾の行(pandora の形)があれば何も書かない", () => {
    const { fork, target } = forkWithTarget();
    write(fork, LEDGER, `${read(fork)}- id:tail-${target.slice(0, 9)} | date:2026-11-24T13:00:00Z | commit:1234abcd | upstream:${target} | relay:none | notes:merge-only tail segment (no notice)\n`);
    const before = read(fork);
    const { code, out } = runLog(fork, ["--upstream=upstream/main", "--tail"]);
    assert.equal(code, 0);
    assert.match(out, /書く物なし/);
    assert.equal(read(fork), before);
  });

  test("--picked: 元の commit を完全な sha で picked: に", () => {
    const { fork, target } = forkWithTarget();
    const base = git(fork, "merge-base", "HEAD", "upstream/main").trim();
    const { code } = runLog(fork, [`--upstream=${base}`, "--id=20261125-000002-hot", `--picked=${target.slice(0, 9)}`, "--relay=none", "--notes=hotfix pick; replaced: x"]);
    assert.equal(code, 0);
    assert.equal(read(fork).trimEnd().split("\n").at(-1), `- id:20261125-000002-hot | date:2026-11-25T01:02:03Z | commit:- | upstream:${base} | picked:${target} | relay:none | notes:hotfix pick; replaced: x`);
  });

  test("leaf: relay: を書かない。台帳が無ければ見出しから作る", () => {
    const { fork, target } = forkWithTarget({ tier: "leaf" });
    rmSync(join(fork, LEDGER));
    const { code } = runLog(fork, ["--upstream=upstream/main", "--id=20261125-000003-c"]);
    assert.equal(code, 0);
    assert.equal(read(fork), `# APPLIED LEDGER fork:git@github.com:acme/child.git\n- id:20261125-000003-c | date:2026-11-25T01:02:03Z | commit:- | upstream:${target} | notes:-\n`);
    assert.equal(runLog(fork, ["--upstream=upstream/main", "--id=20261125-000004-d", "--relay=none"]).code, 2);
  });

  test("書けない(exit 2、何も書かない): 台帳にある id・commit でない upstream・relay の欠け・| の入った notes・--tail と --id", () => {
    const { fork } = forkWithTarget();
    const before = read(fork);
    for (const argv of [
      ["--upstream=upstream/main", "--id=fork-init", "--relay=none"],
      ["--upstream=nope", "--id=20261125-000005-e", "--relay=none"],
      ["--upstream=upstream/main", "--id=20261125-000005-e"],
      ["--upstream=upstream/main", "--id=20261125-000005-e", "--relay=none", "--notes=a | b"],
      ["--upstream=upstream/main", "--tail", "--id=20261125-000005-e"],
      ["--upstream=upstream/main", "--id=20261125-000005-e", "--relay=none", "--bogus=1"],
    ]) {
      assert.equal(runLog(fork, argv).code, 2, argv.join(" "));
      assert.equal(read(fork), before);
    }
    assert.ok(existsSync(join(fork, LEDGER)));
  });
});
