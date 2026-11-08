// scripts/workflow/skills/lib.skillFormat.mjs
// スキルの書式(.claude/rules/core/skills.md)を機械で確かめる部品。入口は check.mjs、テストは skills.test.mjs。
// 文の意味は見ない。見るのは形だけ: 説明文の項目の並び・英語(CJK が無い)・< > が無い・字数・requires の語彙。
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

export const SKILLS_DIR = ".claude/skills";
export const RULE_FILE = ".claude/rules/core/skills.md";
export const PENDING_FILE = "scripts/workflow/skills/pending.txt";
export const MAX_LISTING_CHARS = 1536; // description + when_to_use(一覧はここで切られる)
export const MAX_LINE_CHARS = 400;

// 日本語の文字(かな・漢字・全角の記号)。英語で書く所に 1 つでもあれば落とす
const CJK = /[　-ヿ㐀-鿿豈-﫿＀-￯]/;
const KEY_VALUE = /^[A-Z][A-Z0-9_]*=[a-z0-9][a-z0-9_-]*$/;

// 先頭の frontmatter を key → 値 に読む(1 行 1 項目の `key: value` だけ。値の引用符は外す)
export function parseSkill(text) {
  const m = text.match(/^---\n([\s\S]*?)\n---\n?/);
  if (!m) return { frontmatter: null, body: text, bodyLine: 1 };
  const frontmatter = {};
  for (const line of m[1].split("\n")) {
    const kv = line.match(/^([A-Za-z][\w-]*):\s?(.*)$/);
    if (!kv) continue;
    let value = kv[2].trim();
    if (/^"(.*)"$/.test(value) || /^'(.*)'$/.test(value)) value = value.slice(1, -1);
    frontmatter[kv[1]] = value;
  }
  return { frontmatter, body: text.slice(m[0].length), bodyLine: m[0].split("\n").length - (m[0].endsWith("\n") ? 0 : 1) };
}

// .claude/rules/core/skills.md の `## REQUIRES` の節から上流の語彙(key=value の集合)を読む
export function readVocabulary(ruleText) {
  const vocabulary = new Set();
  const start = ruleText.indexOf("\n## REQUIRES");
  if (start < 0) return vocabulary;
  const rest = ruleText.slice(start + 1).split("\n").slice(1);
  for (const line of rest) {
    if (line.startsWith("## ")) break;
    const item = line.match(/^- ([A-Z][A-Z0-9_]*=[a-z0-9][a-z0-9_-]*):/);
    if (item) vocabulary.add(item[1]);
  }
  return vocabulary;
}

// 本文と付属の .md: 囲み(```)の中とインラインのコードを除いて CJK と長すぎる行を探す
export function proseProblems(text, label, firstLine = 1) {
  const problems = [];
  let fenced = false;
  text.split("\n").forEach((line, index) => {
    if (/^\s*(```|~~~)/.test(line)) {
      fenced = !fenced;
      return;
    }
    if (fenced) return;
    const where = `${label}:${index + firstLine}`;
    if (CJK.test(line.replace(/`[^`]*`/g, ""))) problems.push(`${where}: 日本語は囲み(\`\`\`)の中だけ(人に見せる型)。ほかは英語`);
    if (line.length > MAX_LINE_CHARS) problems.push(`${where}: ${line.length} 字(${MAX_LINE_CHARS} 字以内、sub-bullet に割る)`);
  });
  return problems;
}

/**
 * 説明文の形: `<what> | <when> [| requires: key=value,...]`
 * @returns {{ problems: string[], requires: string[] }}
 */
export function descriptionProblems(description, label) {
  const problems = [];
  const requires = [];
  if (!description) return { problems: [`${label}: description が無い`], requires };
  if (CJK.test(description)) problems.push(`${label}: description に日本語(英語で書く)`);
  if (/[<>]/.test(description)) problems.push(`${label}: description に < > (一覧でエスケープされる。使わない)`);
  const items = description.split(" | ").map((s) => s.trim());
  if (items.some((s) => s === "")) problems.push(`${label}: description に空の項目`);
  const reqIndex = items.findIndex((s) => s.startsWith("requires:"));
  if (reqIndex >= 0 && reqIndex !== items.length - 1) problems.push(`${label}: requires: は最後の項目`);
  if (items.filter((s) => s.startsWith("requires:")).length > 1) problems.push(`${label}: requires: が 2 つ以上`);
  const plain = items.filter((s) => !s.startsWith("requires:"));
  if (plain.length < 2) problems.push(`${label}: description は「何をするか | いつ使うか」の 2 項目以上(\` | \` で区切る)`);
  if (reqIndex >= 0) {
    const list = items[reqIndex].slice("requires:".length).trim();
    for (const pair of list.split(",").map((s) => s.trim())) {
      if (KEY_VALUE.test(pair)) requires.push(pair);
      else problems.push(`${label}: requires の ${pair || "(空)"} が key=value の形でない(KEY=value)`);
    }
  }
  return { problems, requires };
}

/**
 * スキル 1 つ(SKILL.md + 付属の .md)の形を確かめる
 * @param {{ name: string, files: Record<string, string> }} skill files = フォルダからの相対パス → 中身(SKILL.md を含む)
 * @param {Set<string>} vocabulary 上流の requires の語彙
 * @returns {{ problems: string[], unknownRequires: string[] }}
 */
export function checkSkill(skill, vocabulary) {
  const base = `${SKILLS_DIR}/${skill.name}`;
  const problems = [];
  const text = skill.files["SKILL.md"];
  if (text === undefined) return { problems: [`${base}: SKILL.md が無い`], unknownRequires: [] };
  const { frontmatter, body, bodyLine } = parseSkill(text);
  const label = `${base}/SKILL.md`;
  if (!frontmatter) return { problems: [`${label}: frontmatter(--- で囲む)が無い`], unknownRequires: [] };
  if (frontmatter.name !== skill.name) problems.push(`${label}: name: ${frontmatter.name ?? "(無し)"} がフォルダ名 ${skill.name} と違う`);
  const desc = descriptionProblems(frontmatter.description, label);
  problems.push(...desc.problems);
  const whenToUse = frontmatter.when_to_use ?? "";
  if (CJK.test(whenToUse)) problems.push(`${label}: when_to_use に日本語(英語で書く)`);
  if (/[<>]/.test(whenToUse)) problems.push(`${label}: when_to_use に < > (使わない)`);
  const listing = (frontmatter.description ?? "").length + whenToUse.length;
  if (listing > MAX_LISTING_CHARS) problems.push(`${label}: description + when_to_use が ${listing} 字(${MAX_LISTING_CHARS} 字で切られる)`);
  problems.push(...proseProblems(body, label, bodyLine));
  for (const [path, content] of Object.entries(skill.files)) {
    if (path !== "SKILL.md") problems.push(...proseProblems(content, `${base}/${path}`));
  }
  const unknownRequires = desc.requires.filter((pair) => !vocabulary.has(pair));
  return { problems, unknownRequires };
}

// 付属の指示の .md か(README.md は文書なので外す。下のフォルダの .md は付属に含める)
function isAttached(relPath) {
  return relPath.endsWith(".md") && relPath !== "SKILL.md" && relPath.split("/").pop() !== "README.md";
}

function walk(dir, prefix = "") {
  const out = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const rel = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isDirectory()) out.push(...walk(join(dir, entry.name), rel));
    else out.push(rel);
  }
  return out;
}

// リポジトリのスキルを全部読む(SKILL.md と付属の .md)
export function readSkills(root) {
  const dir = join(root, SKILLS_DIR);
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => e.name)
    .sort()
    .map((name) => {
      const files = {};
      for (const rel of walk(join(dir, name))) {
        if (rel === "SKILL.md" || isAttached(rel)) files[rel] = readFileSync(join(dir, name, rel), "utf8");
      }
      return { name, files };
    });
}

// 例外の一覧(1 行 1 スキル名、# から行末はコメント)
export function parsePending(text) {
  return new Set(
    text
      .split("\n")
      .map((line) => line.replace(/#.*$/, "").trim())
      .filter(Boolean),
  );
}

/**
 * 全スキルを確かめて、上流は誤り・fork が足した物は警告・例外の一覧は保留に分ける
 * @param {{ skills: { name: string, files: Record<string, string> }[], isUpstream: (name: string) => boolean, pending: Set<string>, vocabulary: Set<string> }} input
 * @returns {{ errors: string[], warnings: string[], pending: string[], passingPending: string[] }}
 */
export function checkAll({ skills, isUpstream, pending, vocabulary }) {
  const errors = [];
  const warnings = [];
  const pendingOut = [];
  const passingPending = [];
  const names = new Set(skills.map((s) => s.name));
  for (const name of pending) {
    if (!names.has(name)) errors.push(`${PENDING_FILE}: ${name} というスキルが無い(一覧から消す)`);
  }
  for (const skill of skills) {
    const upstream = isUpstream(skill.name);
    const { problems, unknownRequires } = checkSkill(skill, vocabulary);
    const requireMsgs = unknownRequires.map(
      (pair) => `${SKILLS_DIR}/${skill.name}/SKILL.md: requires の ${pair} は上流の語彙(${RULE_FILE} の ## REQUIRES)に無い`,
    );
    if (pending.has(skill.name)) {
      if (problems.length + requireMsgs.length === 0) passingPending.push(skill.name);
      else pendingOut.push(`${skill.name}(${problems.length + requireMsgs.length} 件)`);
      continue;
    }
    if (upstream) {
      errors.push(...problems, ...requireMsgs);
    } else {
      warnings.push(...problems, ...requireMsgs);
    }
  }
  return { errors, warnings, pending: pendingOut, passingPending };
}
