// 型 5 self の検査(self.mjs と check.mjs の collectSelf)。実行: pnpm test src/lib/forkOwnership/self.test.mjs
import assert from "node:assert/strict";
import { after, before, describe, test } from "node:test";

import { runCheck } from "./check.mjs";
import { SELF_CHECK_DEFAULT, SELF_FILES, SELF_OPTIONAL, SELF_REQUIRED, selfProblems } from "./self.mjs";
import { closeTmp, commitAll, git, makeFork, makeParent, openTmp, write } from "./testRepos.mjs";

const PROJECT = ".claude/rules/project.md";
const BEHAVIOR = ".claude/rules/behavior.md";
/** 直下のコードの設定 3 本(型 5、D299)。中身は見ないので 1 行の版 */
const CONFIGS = { "next.config.ts": 'export { default } from "./next.config.core";\n', "eslint.config.mjs": 'export { default } from "./eslint.config.core.mjs";\n', "playwright.config.ts": 'export { default } from "./playwright.config.core";\n' };
const files = (/** @type {string} */ project, /** @type {string | null} */ behavior, repo = "{}\n") => ({ [PROJECT]: project, [BEHAVIOR]: behavior, "repo.json": repo, ...CONFIGS });
const kinds = (/** @type {{ problems: { kind: string, path: string }[] }} */ result) => result.problems.map((problem) => `${problem.kind} ${problem.path}`);
const askKinds = (/** @type {{ asks: { kind: string, path: string }[] }} */ result) => result.asks.map((ask) => `${ask.kind} ${ask.path}`);

describe("selfProblems(純な判定)", () => {
  test("既定は入", () => {
    assert.equal(SELF_CHECK_DEFAULT, true);
  });

  test("Tier1: 必ず持つ 6 つがあり self の行がちょうど 8 行(持たなくてよい vercel.json は無くてよい)なら問題なし", () => {
    const result = selfProblems({ isTier1: true, selfRows: [...SELF_FILES], head: files("a", "b"), merge: null, parentNow: null });
    assert.deepEqual(result, { problems: [], asks: [], unverified: [] });
  });

  test("持たなくてよい vercel.json: あってもなくても問題なし、self の行から抜けたら self-rows(足りない vercel.json)", () => {
    const held = selfProblems({ isTier1: true, selfRows: [...SELF_FILES], head: { ...files("a", "b"), "vercel.json": "{}\n" }, merge: null, parentNow: null });
    assert.deepEqual(held, { problems: [], asks: [], unverified: [] });
    assert.deepEqual(SELF_OPTIONAL, ["vercel.json", "backend-selection.json"]);
    const rows = selfProblems({ isTier1: true, selfRows: [...SELF_REQUIRED, "backend-selection.json"], head: files("a", "b"), merge: null, parentNow: null });
    assert.deepEqual(kinds(rows), ["self-rows src/lib/forkOwnership/intake.txt"]);
    assert.match(rows.problems[0].message, /8 行でない\(足りない: vercel\.json\)/);
  });

  test("ファイルが無い = self-missing、行の集合が違う = self-rows", () => {
    const result = selfProblems({ isTier1: true, selfRows: [PROJECT, "repo.json", "src/x.ts"], head: files("a", null), merge: null, parentNow: null });
    assert.deepEqual(kinds(result), [`self-missing ${BEHAVIOR}`, "self-rows src/lib/forkOwnership/intake.txt"]);
    assert.match(result.problems[1].message, /余分: src\/x\.ts \/ 足りない: \.claude\/rules\/behavior\.md/);
  });

  test("fork: 自分の行が取り込みで消えて親の版と同じ = 聞く(self-parent-lost、落とさない)、概要が親の今の版のまま = self-overview", () => {
    const result = selfProblems({
      isTier1: false,
      selfRows: [...SELF_FILES],
      head: files("parent v2", "parent rules v2"),
      merge: { found: true, before: files("own overview", "own rules"), base: files("parent v2", "parent rules v2"), prevBase: files("parent v1", "parent rules v1") },
      parentNow: "parent v2\n",
    });
    assert.deepEqual(kinds(result), [`self-overview ${PROJECT}`]);
    assert.deepEqual(askKinds(result), [`self-parent-lost ${PROJECT}`, `self-parent-lost ${BEHAVIOR}`]);
  });

  test("fork: 取り込みの前から親の版のまま(親の版をそのまま使う)で、親の新しい版を取り込んだ = 何も言わない(D280)", () => {
    const result = selfProblems({
      isTier1: false,
      selfRows: [...SELF_FILES],
      head: files("own overview", "parent rules v2"),
      merge: { found: true, before: files("own overview", "parent rules v1\n"), base: files("parent overview v2", "parent rules v2"), prevBase: files("parent overview v1", "parent rules v1") },
      parentNow: "parent overview v2",
    });
    assert.deepEqual(result, { problems: [], asks: [], unverified: [] });
  });

  test("fork: 自分の行が残る(取り込みの後も親の版と違う)= 何も言わない。前に取り込んだ版が読めず自分の版が親の版になった = 聞く", () => {
    const kept = selfProblems({
      isTier1: false,
      selfRows: [...SELF_FILES],
      head: files("own overview", "own rules + parent v2 lines"),
      merge: { found: true, before: files("own overview", "own rules"), base: files("parent overview v2", "parent rules v2"), prevBase: files("parent overview v1", "parent rules v1") },
      parentNow: "parent overview v2",
    });
    assert.deepEqual(kept, { problems: [], asks: [], unverified: [] });
    const noPrev = selfProblems({
      isTier1: false,
      selfRows: [...SELF_FILES],
      head: files("own overview", "parent rules v2"),
      merge: { found: true, before: files("own overview", "own rules"), base: files("parent overview v2", "parent rules v2") },
      parentNow: "parent overview v2",
    });
    assert.deepEqual(askKinds(noPrev), [`self-parent-lost ${BEHAVIOR}`]);
    assert.equal(noPrev.problems.length, 0);
  });

  test("fork: 親の版から始めた behavior.md を変えず、親が後で変えても追わなければ問題なし(空白の違いは同じと見る)", () => {
    const result = selfProblems({
      isTier1: false,
      selfRows: [...SELF_FILES],
      head: files("own overview\n", "parent rules v1\n"),
      merge: { found: true, before: files("own overview", "parent rules v1"), base: files("parent overview v2", "parent rules v2") },
      parentNow: "parent overview v2  \n\n",
    });
    assert.deepEqual(result, { problems: [], asks: [], unverified: [] });
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

  const SELF_INTAKE = `edit src/config/**  # 値\nappend src/lib/CATALOG.md  # 目録\n${SELF_FILES.map((path) => `self ${path}  # 型 5\n`).join("")}`;

  /** 親の project.md / behavior.md が変わった版を -X theirs で取り込んだ fork(親の版が入った状態) */
  function forkAfterTakingParent() {
    const parent = makeParent();
    write(parent, "src/lib/forkOwnership/intake.txt", SELF_INTAKE);
    write(parent, PROJECT, "# project\nparent overview\n");
    write(parent, BEHAVIOR, "# behavior\nparent rules\n");
    for (const [path, text] of Object.entries(CONFIGS)) write(parent, path, text);
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

  test("--no-self では走らず結果は合格。既定(入): 親の版のままだった behavior.md は何も言わず、自分の概要が消えた project.md は聞いて、概要は fail", () => {
    const fork = forkAfterTakingParent();
    const off = runCheck(fork, { self: false });
    assert.equal(off.status, "pass");
    assert.equal(off.self.enabled, false);
    const result = runCheck(fork);
    assert.equal(result.status, "fail");
    assert.ok(result.self.enabled);
    assert.deepEqual(kinds(result.self), [`self-overview ${PROJECT}`]);
    assert.deepEqual(askKinds(result.self), [`self-parent-lost ${PROJECT}`]);
    assert.equal(result.counts.self, 1);
  });

  test("親の版をそのまま使う fork(behavior.md を一度も変えず、親の新しい版を取り込んだ)は合格", () => {
    const fork = forkAfterTakingParent();
    git(fork, "checkout", "HEAD^1", "--", PROJECT);
    commitAll(fork, "keep own overview");
    const result = runCheck(fork);
    assert.equal(result.status, "pass");
    assert.ok(result.self.enabled);
    assert.deepEqual(result.self.problems, []);
    assert.deepEqual(result.self.asks, []);
  });

  test("merge の前の自分の版に戻すと問題なし", () => {
    const fork = forkAfterTakingParent();
    git(fork, "checkout", "HEAD^1", "--", PROJECT, BEHAVIOR);
    commitAll(fork, "keep own self files");
    const result = runCheck(fork, { self: true });
    assert.equal(result.status, "pass");
    assert.ok(result.self.enabled);
    assert.deepEqual(result.self.problems, []);
    assert.deepEqual(result.self.asks, []);
    assert.deepEqual(result.self.unverified, []);
  });
});
