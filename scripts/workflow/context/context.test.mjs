// pnpm workflow context facts のテスト。実行: pnpm test scripts/workflow/context/context.test.mjs (node:test)
// 一時の置き場に親(Tier1 役)と fork の git リポジトリ、受け箱、設定の置き場を作って読む(ネットワーク不要)
import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { after, before, describe, test } from "node:test";

import { closeTmp, commitAll, git, makeFork, openTmp, tmpRoot, write } from "../../../src/lib/forkOwnership/node.mjs";
import { collectFacts, contentLines, formatLine, keyOf, parseArgs, wordsOf } from "./lib.mjs";
import { checkRefs, pathRefs } from "./lib.lines.mjs";

const INTAKE = [
  "append src/lib/CATALOG.md  # 目録",
  "edit repo.json  # 名前と段",
  "append .claude/rules/lineage.md  # 中間層の節",
  "self .claude/rules/project.md  # 概要",
  "self .claude/rules/behavior.md  # 作業の決まり",
  "self .claude/rules/shortcuts.md  # 合言葉",
].join("\n");

/** 親(Tier1 役): CLAUDE.md・core・自前の文脈(合言葉も型 5)・lineage の前置き */
const makeParentWithRules = () => {
  const root = join(tmpRoot(), "parent-rules");
  mkdirSync(root);
  git(root, "init", "-q", "-b", "main");
  write(root, "src/lib/CATALOG.md", "# 目録\n\n## parent\n- src/lib/crud — CRUD\n");
  write(root, "repo.json", '{\n  "repo_id": "parent",\n  "tier": "root"\n}\n');
  write(root, "src/lib/forkOwnership/intake.txt", `${INTAKE}\n`);
  write(root, "CLAUDE.md", "# CLAUDE\nship: every commit goes through the ship tool\n");
  write(root, ".claude/rules/core/a.md", "# a\nrelay: the middle tier relays each notice\n");
  write(root, ".claude/rules/items/lib/x.md", "# lib/x\nwhat: x\n");
  write(root, ".claude/rules/project.md", "# project\ntype: upstream template\n");
  write(root, ".claude/rules/behavior.md", "# behavior\n- work_only_on_instructed_scope: true\n");
  write(root, ".claude/rules/shortcuts.md", "# shortcuts\nshort: restate\n");
  write(root, ".claude/rules/lineage.md", "# lineage\n> **ROLE**: 中間層の規則\n<!-- end preamble -->\n");
  commitAll(root, "base");
  return root;
};

let parent;
let fork;
let env;

before(() => {
  openTmp();
  parent = makeParentWithRules();
  fork = makeFork(parent);
  write(
    fork,
    ".claude/rules/behavior.md",
    [
      "# behavior",
      "---",
      "- work_only_on_instructed_scope: true",
      "- ship (priority): push straight to main without the ship tool",
      "  - only for hotfixes the human names",
      "- relay: never (order: 20261121-000000-relay-off)",
      "- open_order: x (order: 20261121-000001-open-one)",
      "- lost: see docs/gone.md and .claude/rules/project.md and core/a.md",
      "- db: run pnpm db:push yourself on production",
      "```",
      "ship: inside a fence is not a line",
      "```",
      "",
    ].join("\n"),
  );
  write(fork, ".claude/rules/own-rule.md", "# own\n- relay: same key as core\nship: every commit goes through the ship tool\n");
  write(fork, ".claude/rules/shortcuts.md", "# shortcuts\nshort: restate\nmine: my shortcut\n");
  write(fork, ".claude/rules/lineage.md", "# lineage\n> **ROLE**: 中間層の規則\n<!-- end preamble -->\n## child\n- tone: polite\n<!-- end child -->\n");
  commitAll(fork, "fork rules");

  const orders = join(tmpRoot(), "orders");
  mkdirSync(join(orders, "parent", "done"), { recursive: true });
  writeFileSync(join(orders, "parent", "done", "20261121-000000-relay-off.md"), "x\n");
  writeFileSync(join(orders, "parent", "20261121-000001-open-one.md"), "x\n");
  const config = join(tmpRoot(), "config");
  mkdirSync(config);
  writeFileSync(join(config, "CLAUDE.md"), "# personal\n- tone (priority): casual\n- address: boss\n");
  writeFileSync(join(fork, "CLAUDE.local.md"), "- local_note: this repo only\n");
  env = { ...process.env, ORDER_STATE_DIR: orders, CLAUDE_CONFIG_DIR: config };
});

after(() => closeTmp());

const byAt = (facts) => new Map(facts.files.flatMap((f) => f.lines.map((l) => [l.at, l])));

describe("行", () => {
  test("keyOf: - key: / key: / > **KEY**: / 括弧の印の付いた鍵。文の行は鍵でない", () => {
    assert.equal(keyOf("- ship: x"), "ship");
    assert.equal(keyOf("ship: x"), "ship");
    assert.equal(keyOf("> **PRIORITY**: x"), "PRIORITY");
    assert.equal(keyOf("- ship (priority): x"), "ship");
    assert.equal(keyOf("  - only for hotfixes"), null);
    assert.equal(keyOf("see: the docs"), "see");
    assert.equal(keyOf("これは文"), null);
  });

  test("contentLines: frontmatter・囲み・見出し・空行を除き、字下げの下の行は上の印を受け継ぐ(見出しからは広げない)", () => {
    const text = "---\npaths: x\n---\n# h (priority)\n- a (priority): 1\n  - a1\n- b: 2\n```\nc: 3\n```\n";
    const lines = contentLines(text);
    assert.deepEqual(lines.map((l) => [l.n, l.key, l.marked]), [[5, "a", true], [6, null, true], [7, "b", false]]);
  });

  test("wordsOf: 許可の語(devcheck の種類・危険な 3 つの入口・決まった語)と環境の語", () => {
    assert.deepEqual(wordsOf("run pnpm db:push on production"), ["perm", "env"]);
    assert.deepEqual(wordsOf("start the dev server"), ["perm"]);
    assert.deepEqual(wordsOf("read .env.development"), ["env"]);
    assert.deepEqual(wordsOf("plain rule"), []);
  });

  test("pathRefs / checkRefs: 括弧書きの始まり・仮の名の手前で切れた語を拾わない、alsoUnder で .claude/rules からの道も探す", () => {
    assert.deepEqual(pathRefs("(core/a.md) and .notices/applied/<name>.md"), ["core/a.md"]);
    assert.deepEqual(checkRefs("core/a.md", fork).gone, ["core/a.md"]);
    assert.deepEqual(checkRefs("core/a.md", fork, { alsoUnder: [".claude/rules"] }).gone, []);
  });

  test("parseArgs: --personal・--fetch だけ", () => {
    assert.deepEqual(parseArgs(["--personal"]), { personal: true, fetch: false });
    assert.throws(() => parseArgs(["--x"]), /知らない引数/);
  });
});

describe("repo", () => {
  test("fork: own と self の物(合言葉も self で丸ごと)、lineage の自分の節を見る(core・items・親の物は見ない)", () => {
    const facts = collectFacts({ cwd: fork, env });
    assert.equal(facts.scope, "repo");
    const files = facts.files.map((f) => `${f.target.path}:${f.target.owner}`).sort();
    assert.deepEqual(files, [".claude/rules/behavior.md:self", ".claude/rules/lineage.md:own", ".claude/rules/own-rule.md:own", ".claude/rules/project.md:self", ".claude/rules/shortcuts.md:self"]);
    const lines = byAt(facts);
    assert.ok(lines.has(".claude/rules/shortcuts.md:3"));
    assert.ok(lines.has(".claude/rules/shortcuts.md:2"), "型 5 self は丸ごと自分の版");
    assert.ok(lines.has(".claude/rules/lineage.md:5"));
    assert.ok(!lines.has(".claude/rules/lineage.md:2"), "前置きは見ない");
  });

  test("fork: 印・字下げの印・依頼の開閉・土台の同じ鍵・同じ字面・消えた参照・語", () => {
    const lines = byAt(collectFacts({ cwd: fork, env }));
    const at = (n, file = ".claude/rules/behavior.md") => lines.get(`${file}:${n}`);
    assert.equal(at(4).mark, "priority");
    assert.deepEqual(at(4).base, ["CLAUDE.md:2"]);
    assert.equal(at(5).mark, "priority", "字下げの下の行");
    assert.equal(at(6).mark, "order:20261121-000000-relay-off:done");
    assert.deepEqual(at(6).base, [".claude/rules/core/a.md:2"]);
    assert.equal(at(7).mark, "order:20261121-000001-open-one:open");
    assert.deepEqual(at(8).refs.gone, ["docs/gone.md"]);
    assert.equal(at(8).refs.total, 3);
    assert.deepEqual(at(9).words, ["perm", "env"]);
    assert.ok(!lines.has(".claude/rules/behavior.md:11"), "囲みの中");
    const same = lines.get(".claude/rules/own-rule.md:3");
    assert.deepEqual(same.same, ["CLAUDE.md:2"]);
    assert.match(formatLine(at(6)), /^\.claude\/rules\/behavior\.md:6 \| key:relay \| mark:order:20261121-000000-relay-off:done \| base:\.claude\/rules\/core\/a\.md:2 \| same:- \| refs:0\/0 \| words:-$/);
  });

  test("Tier1: core・items・lineage を除く .claude/rules の物を丸ごと", () => {
    const facts = collectFacts({ cwd: parent, env });
    const files = facts.files.map((f) => f.target.path).sort();
    assert.deepEqual(files, [".claude/rules/behavior.md", ".claude/rules/project.md", ".claude/rules/shortcuts.md"]);
    assert.ok(byAt(facts).has(".claude/rules/shortcuts.md:2"));
  });
});

describe("personal", () => {
  test("CLAUDE.local.md と設定の置き場の CLAUDE.md。土台にこのリポの自前の文脈も入る", () => {
    const facts = collectFacts({ cwd: fork, env, personal: true });
    assert.equal(facts.scope, "personal");
    assert.deepEqual(facts.files.map((f) => `${f.target.path}:${f.target.owner}`), ["CLAUDE.local.md:personal", "~/.claude/CLAUDE.md:personal"]);
    const lines = byAt(facts);
    const tone = lines.get("~/.claude/CLAUDE.md:2");
    assert.equal(tone.mark, "priority");
    assert.deepEqual(tone.base, [".claude/rules/lineage.md:5"]);
  });
});
