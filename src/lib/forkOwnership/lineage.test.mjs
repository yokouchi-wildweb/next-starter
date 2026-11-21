// lineage.md の構造の検査のテスト。実行: pnpm test src/lib/forkOwnership/lineage.test.mjs (node:test)
import { test } from "node:test";
import assert from "node:assert/strict";

import { checkLineageStructure, formatProblems, parseLineage } from "./lineage.mjs";

const PREAMBLE = "# lineage\n> **ROLE**: x\n<!-- end preamble -->\n";
const section = (name, ...lines) => `## ${name}\n${lines.map((line) => `${line}\n`).join("")}<!-- end ${name} -->\n`;
const structure = (text, { ancestors = ["oripa-do"], own = "pandora", downstream = "yes" } = {}) =>
  checkLineageStructure({ parsed: parseLineage(text), ancestorsOldestFirst: ancestors, own, downstream });

test("parseLineage: 区切り行・節・鍵(- key: だけ)。説明の文・### ・括弧の付いた名前は鍵でない", () => {
  const parsed = parseLineage(
    PREAMBLE + section("oripa-do", "- relay: always", "- tone: polite", "説明の文: これは鍵でない", "### 小見出し", "- prose with spaces: no", "- old (note): x"),
  );
  assert.deepEqual(parsed.preambleEnds, [3]);
  assert.equal(parsed.sections.length, 1);
  assert.equal(parsed.sections[0].closed, true);
  assert.deepEqual(
    parsed.sections[0].keys.map((k) => k.key),
    ["relay", "tone"],
  );
  assert.deepEqual(formatProblems(parsed), []);
});

test("formatProblems: frontmatter・区切り行の数・前置きの中の見出し・名前の形・閉じ忘れ・節の外の行", () => {
  assert.match(formatProblems(parseLineage(`---\npaths: x\n---\n${PREAMBLE}`)).join(), /frontmatter/);
  assert.match(formatProblems(parseLineage("# lineage\n")).join(), /0 個/);
  assert.match(formatProblems(parseLineage(PREAMBLE + PREAMBLE)).join(), /2 個/);
  assert.match(formatProblems(parseLineage(`# l\n## oripa-do\n<!-- end oripa-do -->\n<!-- end preamble -->\n`)).join(), /前置きの中/);
  assert.match(formatProblems(parseLineage(PREAMBLE + section("Oripa_Do"))).join(), /fork の名前の形/);
  assert.match(formatProblems(parseLineage(`${PREAMBLE}## oripa-do\n- a: 1\n`)).join(), /閉じていない/);
  assert.match(formatProblems(parseLineage(`${PREAMBLE}## oripa-do\n- a: 1\n<!-- end pandora -->\n`)).join(), /閉じていない/);
  assert.match(formatProblems(parseLineage(`${PREAMBLE + section("oripa-do")}stray\n`)).join(), /節の外/);
  assert.deepEqual(formatProblems(parseLineage(PREAMBLE)), [], "Tier1 の前置きだけ");
});

test("checkLineageStructure: 祖先の古い順 + 自分は最後。知らない名前・逆順・重複・鍵の重複・none で自分の節は失敗", () => {
  const tier3 = { ancestors: ["oripa-do", "mid"], own: "pandora" };
  assert.deepEqual(structure(PREAMBLE + section("oripa-do") + section("mid") + section("pandora"), tier3), []);
  assert.deepEqual(structure(PREAMBLE + section("mid"), tier3), [], "祖先の節は在るものだけ(部分列)");
  assert.deepEqual(structure(PREAMBLE, tier3), []);
  assert.match(structure(PREAMBLE + section("mid") + section("oripa-do"), tier3).join(), /並びが違う/);
  assert.match(structure(PREAMBLE + section("pandora") + section("mid"), tier3).join(), /並びが違う/);
  assert.match(structure(PREAMBLE + section("oripa-do") + section("oripa-do"), tier3).join(), /並びが違う/);
  assert.match(structure(PREAMBLE + section("stranger"), tier3).join(), /祖先でも自分でもない/);
  assert.match(structure(PREAMBLE + section("oripa-do", "- a: 1", "- a: 2")).join(), /鍵 a が重複/);
  assert.match(structure(PREAMBLE + section("pandora", "- a: 1"), { downstream: "none" }).join(), /tier leaf/);
  assert.deepEqual(structure(PREAMBLE + section("oripa-do", "- a: 1"), { downstream: "none" }), [], "none でも祖先の節は在ってよい");
});
