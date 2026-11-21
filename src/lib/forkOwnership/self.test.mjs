// 型 5 self の検査(self.mjs と check.mjs の collectSelf)。実行: pnpm test src/lib/forkOwnership/self.test.mjs
import assert from "node:assert/strict";
import { after, before, describe, test } from "node:test";

import { runCheck } from "./check.mjs";
import { SELF_CHECK_DEFAULT, SELF_FILES, selfProblems } from "./self.mjs";
import { closeTmp, commitAll, git, makeFork, makeParent, openTmp, write } from "./testRepos.mjs";

const PROJECT = ".claude/rules/project.md";
const BEHAVIOR = ".claude/rules/behavior.md";
const files = (/** @type {string} */ project, /** @type {string | null} */ behavior, repo = "{}\n") => ({ [PROJECT]: project, [BEHAVIOR]: behavior, "repo.json": repo });
const kinds = (/** @type {{ problems: { kind: string, path: string }[] }} */ result) => result.problems.map((problem) => `${problem.kind} ${problem.path}`);

describe("selfProblems(純な判定)", () => {
  test("既定は入", () => {
    assert.equal(SELF_CHECK_DEFAULT, true);
  });

  test("Tier1: 3 つのファイルがあり self の行がちょうど 3 行なら問題なし", () => {
    const result = selfProblems({ isTier1: true, selfRows: [...SELF_FILES], head: files("a", "b"), merge: null, parentNow: null });
    assert.deepEqual(result, { problems: [], unverified: [] });
  });

  test("ファイルが無い = self-missing、行の集合が違う = self-rows", () => {
    const result = selfProblems({ isTier1: true, selfRows: [PROJECT, "repo.json", "src/x.ts"], head: files("a", null), merge: null, parentNow: null });
    assert.deepEqual(kinds(result), [`self-missing ${BEHAVIOR}`, "self-rows src/lib/forkOwnership/intake.txt"]);
    assert.match(result.problems[1].message, /余分: src\/x\.ts \/ 足りない: \.claude\/rules\/behavior\.md/);
  });

  test("fork: 取り込みで親の版が入ったまま = self-parent、概要が親の今の版のまま = self-overview", () => {
    const result = selfProblems({
      isTier1: false,
      selfRows: [...SELF_FILES],
      head: files("parent v2", "own rules"),
      merge: { found: true, before: files("own overview", "own rules"), base: files("parent v2", "parent rules v2") },
      parentNow: "parent v2\n",
    });
    assert.deepEqual(kinds(result), [`self-parent ${PROJECT}`, `self-overview ${PROJECT}`]);
  });

  test("fork: 親の版から始めた behavior.md を変えず、親が後で変えても追わなければ問題なし(空白の違いは同じと見る)", () => {
    const result = selfProblems({
      isTier1: false,
      selfRows: [...SELF_FILES],
      head: files("own overview\n", "parent rules v1\n"),
      merge: { found: true, before: files("own overview", "parent rules v1"), base: files("parent overview v2", "parent rules v2") },
      parentNow: "parent overview v2  \n\n",
    });
    assert.deepEqual(result, { problems: [], unverified: [] });
  });

  test("fork: merge が無い・基準に self の行が無い = 未検証の項(問題にはしない)", () => {
    const result = selfProblems({ isTier1: false, selfRows: [], head: files("own", "rules"), merge: { found: false, before: {}, base: {} }, parentNow: "parent" });
    assert.equal(result.problems.length, 0);
    assert.equal(result.unverified.length, 2);
  });
});

describe("pnpm workflow ownership check --self(作り物の親と fork)", () => {
  before(() => {
    openTmp();
  });
  after(() => {
    closeTmp();
  });

  const SELF_INTAKE = "edit src/config/**  # 値\nappend src/lib/CATALOG.md  # 目録\nself .claude/rules/project.md  # 概要\nself .claude/rules/behavior.md  # 作業の決まり\nself repo.json  # 名前と段\n";

  /** 親の project.md / behavior.md が変わった版を -X theirs で取り込んだ fork(親の版が入った状態) */
  function forkAfterTakingParent() {
    const parent = makeParent();
    write(parent, "src/lib/forkOwnership/intake.txt", SELF_INTAKE);
    write(parent, PROJECT, "# project\nparent overview\n");
    write(parent, BEHAVIOR, "# behavior\nparent rules\n");
    commitAll(parent, "self files");
    const fork = makeFork(parent);
    write(fork, PROJECT, "# project\nchild overview\n");
    commitAll(fork, "own overview");
    write(parent, PROJECT, "# project\nparent overview v2\n");
    write(parent, BEHAVIOR, "# behavior\nparent rules v2\n");
    commitAll(parent, "parent v2");
    git(fork, "fetch", "-q", "upstream");
    git(fork, "merge", "-q", "--no-edit", "-X", "theirs", "upstream/main");
    return fork;
  }

  test("--no-self では走らず結果は合格、既定(入)で取り込んだ親の版を挙げて fail", () => {
    const fork = forkAfterTakingParent();
    const off = runCheck(fork, { self: false });
    assert.equal(off.status, "pass");
    assert.equal(off.self.enabled, false);
    const result = runCheck(fork);
    assert.equal(result.status, "fail");
    assert.ok(result.self.enabled);
    assert.deepEqual(kinds(result.self), [`self-parent ${PROJECT}`, `self-parent ${BEHAVIOR}`, `self-overview ${PROJECT}`]);
    assert.equal(result.counts.self, 3);
  });

  test("merge の前の自分の版に戻すと問題なし", () => {
    const fork = forkAfterTakingParent();
    git(fork, "checkout", "HEAD^1", "--", PROJECT, BEHAVIOR);
    commitAll(fork, "keep own self files");
    const result = runCheck(fork, { self: true });
    assert.equal(result.status, "pass");
    assert.ok(result.self.enabled);
    assert.deepEqual(result.self.problems, []);
    assert.deepEqual(result.self.unverified, []);
  });
});
