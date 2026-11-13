// lineage.md の構造と打ち消しの検査のテスト。実行: pnpm test src/lib/forkOwnership/lineage.test.mjs (node:test)
import { test } from "node:test";
import assert from "node:assert/strict";

import { checkLineageStructure, checkOverrides, formatProblems, parseLineage, parseOverrideBody, touchedOverrides } from "./lineage.mjs";

const PREAMBLE = "# lineage\n> **ROLE**: x\n<!-- end preamble -->\n";
const section = (name, ...lines) => `## ${name}\n${lines.map((line) => `${line}\n`).join("")}<!-- end ${name} -->\n`;
const structure = (text, { ancestors = ["oripa-do"], own = "pandora", downstream = "yes" } = {}) =>
  checkLineageStructure({ parsed: parseLineage(text), ancestorsOldestFirst: ancestors, own, downstream });

test("parseLineage: 区切り行・節・鍵(- key: / - key (default):)・overrides 行。説明の文と ### は鍵でない", () => {
  const parsed = parseLineage(
    PREAMBLE + section("oripa-do", "- relay: always", "- tone (default): polite", "説明の文: これは鍵でない", "### 小見出し", "- prose with spaces: no", "overrides: x.y = 1 | why: r"),
  );
  assert.deepEqual(parsed.preambleEnds, [3]);
  assert.equal(parsed.sections.length, 1);
  assert.equal(parsed.sections[0].closed, true);
  assert.deepEqual(
    parsed.sections[0].keys.map((k) => `${k.key}:${k.isDefault}`),
    ["relay:false", "tone:true"],
  );
  assert.equal(parsed.sections[0].overrides.length, 1);
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
  assert.match(structure(PREAMBLE + section("oripa-do", "- a: 1", "- a (default): 2")).join(), /鍵 a が重複/);
  assert.deepEqual(structure(PREAMBLE + section("oripa-do", "- a: 1", "overrides: x.a = 1 | why: r", "overrides: x.a = 1 | why: r")), [], "overrides 行は鍵に数えない");
  assert.match(structure(PREAMBLE + section("pandora", "- a: 1"), { downstream: "none" }).join(), /tier leaf/);
  assert.deepEqual(structure(PREAMBLE + section("oripa-do", "- a: 1"), { downstream: "none" }), [], "none でも祖先の節は在ってよい");
});

test("parseOverrideBody: 形・値・why: の理由", () => {
  assert.deepEqual(parseOverrideBody("oripa-do.tone = casual | why: 若年層向け"), { owner: "oripa-do", key: "tone", value: "casual", why: "若年層向け" });
  assert.match(parseOverrideBody("tone = casual | why: r").error, /形が違う/);
  assert.match(parseOverrideBody("oripa-do.tone = casual").error, /形が違う/);
  assert.match(parseOverrideBody("oripa-do.tone = casual | why: ").error, /理由が無い/);
  assert.match(parseOverrideBody("oripa-do.tone =  | why: r").error, /値が空/);
});

test("checkOverrides: (default) の祖先の鍵だけ。無い節・無い鍵・(default) でない・同じ対象 2 回・形違いは失敗、同名の鍵は警告", () => {
  const lineage = parseLineage(PREAMBLE + section("oripa-do", "- relay: always", "- tone (default): polite") + section("pandora", "overrides: oripa-do.tone = brief | why: 下流にも"));
  const run = (projectText) => checkOverrides({ parsed: lineage, projectText, own: "pandora" });

  assert.deepEqual(run("## TIER\nfork_id: pandora\n- overrides: oripa-do.tone = casual | why: 若年層向け\n"), { failures: [], warnings: [] });
  assert.match(run("overrides: someone.tone = x | why: r\n").failures.join(), /祖先に無い/);
  assert.match(run("overrides: pandora.tone = x | why: r\n").failures.join(), /祖先に無い/, "自分の節は名指せない");
  assert.match(run("overrides: oripa-do.missing = x | why: r\n").failures.join(), /鍵が節 oripa-do に無い/);
  assert.match(run("overrides: oripa-do.relay = x | why: r\n").failures.join(), /\(default\) でない/);
  assert.match(run("overrides: oripa-do.tone = x | why: r\noverrides: oripa-do.tone = y | why: r\n").failures.join(), /2 回/);
  assert.match(run("overrides: oripa-do.tone = x\n").failures.join(), /形が違う/);

  // 自分の節の打ち消しも同じ検査(同じ節で 2 回・(default) でない)
  const badOwn = parseLineage(PREAMBLE + section("oripa-do", "- relay: always") + section("pandora", "overrides: oripa-do.relay = x | why: r"));
  assert.match(checkOverrides({ parsed: badOwn, projectText: "", own: "pandora" }).failures.join(), /lineage.md の節 pandora .*\(default\) でない/);
  // project.md と自分の節で同じ対象 = 別の場所なので 2 回に数えない
  assert.deepEqual(run("overrides: oripa-do.tone = casual | why: r\n").failures, []);

  // 祖先の鍵と同名の鍵を overrides なしで書く = 警告(合否は変えない)
  const warned = run("## RULES\n- tone: casual\n");
  assert.deepEqual(warned.failures, []);
  assert.match(warned.warnings.join(), /鍵 tone は祖先/);
  assert.deepEqual(run("- tone: casual\noverrides: oripa-do.tone = casual | why: r\n").warnings, []);
});

test("touchedOverrides: 名指す鍵の行が変わった・消えた・(default) が外れた = 接触、他の鍵の変更・名指し先が前から無いのは接触でない", () => {
  const before = PREAMBLE + section("oripa-do", "- tone (default): polite", "- relay: always") + section("pandora", "overrides: oripa-do.relay = x | why: r");
  const projectText = "overrides: oripa-do.tone = casual | why: r\noverrides: oripa-do.ghost = 1 | why: r\n";
  const run = (after) => touchedOverrides({ before, after, projectText, own: "pandora" });

  assert.deepEqual(run(before), []);
  assert.deepEqual(run(PREAMBLE + section("oripa-do", "- tone (default): polite", "- relay: always", "- new: 1") + section("pandora", "overrides: oripa-do.relay = x | why: r")), [], "他の鍵を足しただけ");
  const changed = run(PREAMBLE + section("oripa-do", "- tone (default): formal", "- relay: always") + section("pandora", "overrides: oripa-do.relay = x | why: r"));
  assert.deepEqual(changed.map((t) => `${t.target}:${t.change}`), ["oripa-do.tone:changed"]);
  assert.equal(changed[0].where, ".claude/rules/project.md");
  const removed = run(PREAMBLE + section("oripa-do", "- relay: never") + section("pandora", "overrides: oripa-do.relay = x | why: r"));
  assert.deepEqual(removed.map((t) => `${t.target}:${t.change}`).sort(), ["oripa-do.relay:changed", "oripa-do.tone:removed"], "自分の節の打ち消しも見る");
  const undefaulted = run(PREAMBLE + section("oripa-do", "- tone: polite", "- relay: always") + section("pandora", "overrides: oripa-do.relay = x | why: r"));
  assert.deepEqual(undefaulted.map((t) => `${t.target}:${t.change}`), ["oripa-do.tone:default-removed"]);
  assert.deepEqual(run(null).map((t) => t.change).sort(), ["removed", "removed"], "lineage.md ごと消えた");
  assert.deepEqual(touchedOverrides({ before: null, after: before, projectText, own: "pandora" }), [], "取り込む前に無かった");
});
