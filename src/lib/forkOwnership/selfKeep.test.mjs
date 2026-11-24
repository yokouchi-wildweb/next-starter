// 型 5 self を区間の merge の後に自分の版に戻す(selfKeep.mjs・self.mjs の planSelfKeep)。実行: pnpm test src/lib/forkOwnership/selfKeep.test.mjs
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { after, before, describe, test } from "node:test";

import { SELF_FILES, SELF_OPTIONAL, SELF_REQUIRED, planSelfKeep } from "./self.mjs";
import { selfKeep } from "./selfKeep.mjs";
import { closeTmp, commitAll, git, makeFork, makeParent, openTmp, write } from "./testRepos.mjs";

const PROJECT = ".claude/rules/project.md";
const BEHAVIOR = ".claude/rules/behavior.md";
const OPTIONAL = SELF_OPTIONAL[SELF_OPTIONAL.length - 1];
const NEW_REQUIRED = ".claude/rules/shortcuts.md";

describe("planSelfKeep(純)", () => {
  test("前の版と違えば戻す・同じなら何もしない・前に無かった物は必ず持つなら親の版を残し、持たなくてよいなら消す", () => {
    const steps = planSelfKeep({
      paths: ["a", "b", "c", "d", "e"],
      required: ["a", "b", "c"],
      pre: { a: "mine\n", b: "same\n", c: null, d: null, e: null },
      now: { a: "parent\n", b: "same\n", c: "parent\n", d: "parent\n", e: null },
    });
    assert.deepEqual(steps.map((s) => `${s.path}:${s.action}`), ["a:restore", "b:same", "c:keep-new", "d:remove", "e:same"]);
  });
});

describe("selfKeep(git)", () => {
  before(() => openTmp());
  after(() => closeTmp());

  /** 親が self を衝突しない形で変え、fork が --no-commit で merge した状態 → { fork, pre } */
  function mergedFork() {
    const parent = makeParent();
    write(parent, "src/lib/forkOwnership/intake.txt", `edit src/config/**  # 値\n${SELF_FILES.map((p) => `self ${p}  # 型 5\n`).join("")}`);
    write(parent, PROJECT, "# project\nparent overview\n");
    write(parent, BEHAVIOR, "# behavior\nparent rules\n");
    commitAll(parent, "self files");
    const fork = makeFork(parent);
    write(fork, PROJECT, "# project\nchild overview\n");
    write(fork, OPTIONAL, "{}\n");
    commitAll(fork, "own versions");
    const pre = git(fork, "rev-parse", "HEAD").trim();
    // 親: project.md の別の行・持たなくてよい self を足す・必ず持つ self を新しく足す(fork は持っていない)・behavior.md は触らない
    write(parent, PROJECT, "# project\nparent overview\nparent tail\n");
    write(parent, OPTIONAL, '{"mail":"resend"}\n');
    write(parent, NEW_REQUIRED, "# shortcuts\nshort: restate\n");
    commitAll(parent, "parent v2");
    git(fork, "fetch", "-q", "upstream");
    git(fork, "merge", "-q", "--no-commit", "--no-ff", "-X", "theirs", "upstream/main");
    return { fork, pre };
  }

  test("衝突しない上流の変更も、区間の差分に入った self は取り込みの前の自分の版に戻す(dry-run は書かない)", () => {
    const { fork, pre } = mergedFork();
    const merged = readFileSync(join(fork, PROJECT), "utf8");
    assert.notEqual(merged, "# project\nchild overview\n", "merge が親の版を入れた");
    const dry = selfKeep(fork, { pre, target: "upstream/main" });
    assert.equal(dry.status, "ok");
    const actions = Object.fromEntries((dry.status === "ok" ? dry.steps : []).map((s) => [s.path, s.action]));
    assert.equal(actions[PROJECT], "restore");
    assert.equal(actions[BEHAVIOR], undefined, "区間の差分に無い self は並べない");
    assert.equal(readFileSync(join(fork, PROJECT), "utf8"), merged, "dry-run は書かない");

    const applied = selfKeep(fork, { pre, target: "upstream/main", apply: true });
    assert.equal(applied.status, "ok");
    assert.equal(readFileSync(join(fork, PROJECT), "utf8"), "# project\nchild overview\n");
    assert.equal(readFileSync(join(fork, OPTIONAL), "utf8"), "{}\n", "持たなくてよい self の上流の値は入らない");
    assert.ok(SELF_REQUIRED.includes(NEW_REQUIRED));
    assert.equal(readFileSync(join(fork, NEW_REQUIRED), "utf8"), "# shortcuts\nshort: restate\n", "前に無かった必ず持つ self は親の版を最初の自分の版に");
    const diffLine = (applied.status === "ok" ? applied.steps : []).find((s) => s.path === PROJECT)?.diff ?? "";
    assert.match(diffLine, /^git diff \S+\.\.\.\S+ -- \.claude\/rules\/project\.md$/);
  });

  test("前に無かった持たなくてよい self は消す(自分の版 = 無い)", () => {
    const parent = makeParent();
    const fork = makeFork(parent);
    const pre = git(fork, "rev-parse", "HEAD").trim();
    write(parent, OPTIONAL, '{"mail":"resend"}\n');
    commitAll(parent, "optional self");
    git(fork, "fetch", "-q", "upstream");
    git(fork, "merge", "-q", "--no-commit", "--no-ff", "upstream/main");
    const result = selfKeep(fork, { pre, target: "upstream/main", apply: true });
    assert.equal(result.status === "ok" && result.steps.find((s) => s.path === OPTIONAL)?.action, "remove");
    assert.ok(!existsSync(join(fork, OPTIONAL)));
  });

  test("解けない rev は unverified", () => {
    const parent = makeParent();
    assert.equal(selfKeep(parent, { pre: "nope", target: "HEAD" }).status, "unverified");
  });
});
