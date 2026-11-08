// scripts/workflow/skills/skills.test.mjs
// スキルの書式の検査(check.mjs / lib.skillFormat.mjs)のテスト。実行: pnpm test scripts/workflow/skills/skills.test.mjs (node:test)
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { runCheck } from "./check.mjs";
import { checkAll, checkSkill, descriptionProblems, parsePending, parseSkill, proseProblems, readVocabulary, RULE_FILE } from "./lib.skillFormat.mjs";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "../../..");
const vocabulary = new Set(["AGENT_TERMINAL=tmux"]);

function skill(name, { description, whenToUse, body = "role: test skill\n\n1. do the thing\n", extra = {} } = {}) {
  const fm = [`name: ${name}`, `description: ${description ?? "Do the thing | When the user asks for the thing"}`];
  if (whenToUse !== undefined) fm.push(`when_to_use: ${whenToUse}`);
  return { name, files: { "SKILL.md": `---\n${fm.join("\n")}\n---\n${body}`, ...extra } };
}

test("良い形のスキルは通る(requires つき・囲みの中の日本語・インラインのコード)", () => {
  const s = skill("good", {
    description: "Send a peer message | When another session must be told | requires: AGENT_TERMINAL=tmux",
    body: "role: x\n\n1. run `pnpm 日本語`\n2. report\n```\n報告: 終わりました\n```\nSTOP: wait for the user\n",
    extra: { "template.md": "# template\nkey: value\n" },
  });
  assert.deepEqual(checkSkill(s, vocabulary), { problems: [], unknownRequires: [] });
});

test("説明文の誤り: 日本語・< >・項目が 1 つ・requires が最後でない・key=value でない", () => {
  const check = (d) => descriptionProblems(d, "x").problems.join("\n");
  assert.match(check("スキル | 使うとき"), /日本語/);
  assert.match(check("Do <thing> | When"), /< >/);
  assert.match(check("Only one item"), /2 項目以上/);
  assert.match(check("Do | requires: AGENT_TERMINAL=tmux | When"), /最後の項目/);
  assert.match(check("Do | When | requires: tmux"), /key=value/);
  assert.match(check(undefined), /description が無い/);
  assert.deepEqual(descriptionProblems("Do | When | requires: A=b, C=d", "x"), { problems: [], requires: ["A=b", "C=d"] });
});

test("本文と付属の .md: 囲みの外の日本語・長すぎる行・name の食い違い・字数の上限", () => {
  const s = skill("named", { body: "1. 手順\n" + "a".repeat(401) + "\n", extra: { "brief.md": "説明\n```\n型\n```\n" } });
  s.files["SKILL.md"] = s.files["SKILL.md"].replace("name: named", "name: other");
  const { problems } = checkSkill(s, vocabulary);
  const text = problems.join("\n");
  assert.match(text, /name: other がフォルダ名 named と違う/);
  assert.match(text, /SKILL\.md:5: 日本語/);
  assert.match(text, /401 字/);
  assert.match(text, /brief\.md:1: 日本語/);
  assert.doesNotMatch(text, /brief\.md:3/);
  const long = skill("long", { whenToUse: "w".repeat(1600) });
  assert.match(checkSkill(long, vocabulary).problems.join("\n"), /1536 字で切られる/);
  assert.deepEqual(proseProblems("```\n日本語\n```\nok\n", "f"), []);
});

test("上流のスキルの誤りは errors、fork が足したスキルは warnings(exit 0 の側)", () => {
  const bad = skill("bad", { description: "日本語の説明" });
  const r = checkAll({ skills: [bad, skill("fork-bad", { description: "日本語" })], isUpstream: (n) => n === "bad", pending: new Set(), vocabulary });
  assert.ok(r.errors.length > 0 && r.errors.every((e) => e.includes("/bad/")));
  assert.ok(r.warnings.length > 0 && r.warnings.every((e) => e.includes("/fork-bad/")));
});

test("requires の知らない鍵: 上流は error、fork は warning", () => {
  const s = (name) => skill(name, { description: "Do | When | requires: FORK_THING=on" });
  const r = checkAll({ skills: [s("up"), s("mine")], isUpstream: (n) => n === "up", pending: new Set(), vocabulary });
  assert.equal(r.errors.length, 1);
  assert.match(r.errors[0], /up\/SKILL\.md: requires の FORK_THING=on は上流の語彙/);
  assert.equal(r.warnings.length, 1);
  assert.match(r.warnings[0], /mine/);
});

test("例外の一覧: 載っているスキルは保留(落とさない)、満たしたら外す案内、無いスキルの名前は誤り", () => {
  const r = checkAll({
    skills: [skill("old", { description: "古い説明" }), skill("done")],
    isUpstream: () => true,
    pending: parsePending("# comment\nold\ndone  # 書き直し済み\nghost\n"),
    vocabulary,
  });
  assert.deepEqual(r.pending, ["old(2 件)"]);
  assert.deepEqual(r.passingPending, ["done"]);
  assert.deepEqual(r.errors, ["scripts/workflow/skills/pending.txt: ghost というスキルが無い(一覧から消す)"]);
});

function forkRepo(t, { ledger }) {
  const root = mkdtempSync(join(tmpdir(), "skills-check-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  mkdirSync(join(root, ".claude/rules"), { recursive: true });
  writeFileSync(join(root, ".claude/rules/project.md"), "# project\nfork_id: my-fork\ndownstream: none\n");
  if (ledger) {
    mkdirSync(join(root, ".notices/applied"), { recursive: true });
    writeFileSync(join(root, ".notices/applied/my-fork.md"), ledger);
  }
  mkdirSync(join(root, ".claude/skills/a"), { recursive: true });
  writeFileSync(join(root, ".claude/skills/a/SKILL.md"), "---\nname: a\ndescription: 日本語\n---\n");
  return root;
}

test("fork で基準の版が読めない → exit 2(確かめられない。通ったことにしない)", (t) => {
  const lines = [];
  assert.equal(runCheck(forkRepo(t, { ledger: null }), { log: (l) => lines.push(l) }), 2);
  assert.match(lines.join("\n"), /確かめられない/);
  const lines2 = [];
  assert.equal(runCheck(forkRepo(t, { ledger: "- x upstream:0123456789abcdef0123456789abcdef01234567\n" }), { log: (l) => lines2.push(l) }), 2);
});

test("readVocabulary: skills.md の ## REQUIRES から key=value を読む", () => {
  assert.deepEqual([...readVocabulary("# x\n## REQUIRES\n> note\n- A=b: why\n- C_D=e-f: why\n## CHECK\n- X=y: no\n")], ["A=b", "C_D=e-f"]);
  assert.ok(readVocabulary(readFileSync(join(repoRoot, RULE_FILE), "utf8")).has("AGENT_TERMINAL=tmux"));
});

test("parseSkill: 引用符を外す・frontmatter が無い", () => {
  assert.equal(parseSkill('---\nname: x\nargument-hint: "[a]"\n---\nbody').frontmatter["argument-hint"], "[a]");
  assert.equal(parseSkill("no frontmatter").frontmatter, null);
});

test("このリポ(Tier1)は通る", () => {
  const lines = [];
  assert.equal(runCheck(repoRoot, { log: (l) => lines.push(l) }), 0, lines.join("\n"));
});
