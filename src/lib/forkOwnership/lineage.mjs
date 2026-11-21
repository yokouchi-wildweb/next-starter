// 中間層の規則のファイル(.claude/rules/lineage.md)の構造の検査。git に触れない純関数だけ。Node 組み込みだけで動く .mjs
// 仕様: .claude/rules/lineage.md の前置き・./README.md「多段の Tier」
//
// - 形: 前置き → `<!-- end preamble -->` → `## <fork_id>` の節を古い祖先から順(自分は在れば最後)、各節は `<!-- end <fork_id> -->` で閉じる
// - 鍵: 節の中の `- <key>: ...` の行だけ(説明の文・### 小見出しは契約の本文)。節の中で一意
// - 下の段が祖先の鍵を変える道は、自分の文脈に同じ鍵を (priority) 付きで書くこと(core/design.md priority)。読み方の決まりで、検査はしない
// - 書式(formatProblems)は pnpm check rules が全 repo で、並び・鍵(checkLineageStructure)は pnpm workflow ownership check が fork で見る

import { FORK_ID_PATTERN } from "./forkIds.mjs";

export const LINEAGE_FILE = ".claude/rules/lineage.md";
export const PREAMBLE_END = "<!-- end preamble -->";

const HEADING = /^##\s+(.*?)\s*$/;
const SECTION_END = /^<!-- end (\S+) -->\s*$/;
const KEY_LINE = /^- ([A-Za-z0-9_-]+):(?:\s|$)/;

/**
 * lineage.md を読む
 * @param {string} text
 * @returns {{
 *   frontmatter: boolean,
 *   preambleEnds: number[],
 *   sections: { name: string, line: number, closed: boolean, keys: { key: string, line: number, text: string }[] }[],
 *   stray: number[],
 * }} stray = 節の外(区切り行の後)の空でない行の行番号
 */
export function parseLineage(text) {
  const lines = text.split("\n");
  const preambleEnds = [];
  const sections = [];
  const stray = [];
  let current = null;
  lines.forEach((raw, index) => {
    const line = raw.trimEnd();
    const number = index + 1;
    if (line === PREAMBLE_END) {
      preambleEnds.push(number);
      current = null;
      return;
    }
    const heading = HEADING.exec(line);
    if (heading) {
      current = { name: heading[1], line: number, closed: false, keys: [] };
      sections.push(current);
      return;
    }
    if (current && !current.closed) {
      const end = SECTION_END.exec(line);
      if (end && end[1] === current.name) {
        current.closed = true;
        return;
      }
      const key = KEY_LINE.exec(line);
      if (key) current.keys.push({ key: key[1], line: number, text: line });
      return;
    }
    if (preambleEnds.length > 0 && line.trim() !== "") stray.push(number);
  });
  return { frontmatter: lines[0]?.trim() === "---", preambleEnds, sections, stray };
}

/**
 * 書式の誤り(並び・祖先の名前を知らなくても言えるもの)。pnpm check rules と pnpm workflow ownership check の両方が使う
 * @param {ReturnType<typeof parseLineage>} parsed
 * @returns {string[]}
 */
export function formatProblems(parsed) {
  const problems = [];
  if (parsed.frontmatter) problems.push("frontmatter がある(paths なしの常時読み込みにする)");
  if (parsed.preambleEnds.length !== 1) problems.push(`区切り行 ${PREAMBLE_END} がちょうど 1 つでない(${parsed.preambleEnds.length} 個)`);
  const end = parsed.preambleEnds[0] ?? Infinity;
  for (const section of parsed.sections) {
    if (section.line < end) problems.push(`${section.line} 行目: 前置きの中に ## 見出し(節は区切り行の後に置く)`);
    if (!FORK_ID_PATTERN.test(section.name)) problems.push(`${section.line} 行目: 節の見出し「${section.name}」が fork の名前の形でない`);
    if (!section.closed) problems.push(`${section.line} 行目: 節 ${section.name} が <!-- end ${section.name} --> で閉じていない`);
  }
  for (const line of parsed.stray) problems.push(`${line} 行目: 節の外の行(区切り行の後は節だけ)`);
  return problems;
}

/**
 * 構造の検査(fork の pnpm workflow ownership check)
 * @param {{ parsed: ReturnType<typeof parseLineage>, ancestorsOldestFirst: string[], own: string, downstream: "yes" | "none" | null }} input
 *   ancestorsOldestFirst = 節を持ちうる祖先(Tier1 を除く中間層)の名前、古い順
 * @returns {string[]} 失敗
 */
export function checkLineageStructure({ parsed, ancestorsOldestFirst, own, downstream }) {
  const failures = formatProblems(parsed);
  const order = [...ancestorsOldestFirst, own];
  let last = -1;
  for (const section of parsed.sections) {
    const at = order.indexOf(section.name);
    if (at === -1) {
      failures.push(`${section.line} 行目: 節 ${section.name} は祖先でも自分でもない(祖先 = ${ancestorsOldestFirst.join(", ") || "なし"}、自分 = ${own})`);
      continue;
    }
    if (at <= last) failures.push(`${section.line} 行目: 節 ${section.name} の並びが違う(古い祖先から順、自分は最後、同じ名前は 1 回)`);
    last = Math.max(last, at);
    const seen = new Map();
    for (const { key, line } of section.keys) {
      if (seen.has(key)) failures.push(`${line} 行目: 節 ${section.name} の鍵 ${key} が重複(${seen.get(key)} 行目)`);
      else seen.set(key, line);
    }
  }
  if (downstream === "none" && parsed.sections.some((section) => section.name === own)) {
    failures.push(`tier leaf(下流なし)なのに自分の節 ${own} がある(下流に渡す規則を持つなら repo.json の tier を middle に)`);
  }
  return failures;
}
