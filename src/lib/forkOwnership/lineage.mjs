// 中間層の規則のファイル(.claude/rules/lineage.md)の構造と打ち消しの検査。git に触れない純関数だけ。Node 組み込みだけで動く .mjs
// 仕様: .claude/rules/lineage.md の前置き・./README.md「多段の Tier」
//
// - 形: 前置き → `<!-- end preamble -->` → `## <fork_id>` の節を古い祖先から順(自分は在れば最後)、各節は `<!-- end <fork_id> -->` で閉じる
// - 鍵: 節の中の `- <key>: ...` / `- <key> (default): ...` の行だけ(説明の文・### 小見出しは契約の本文)。節の中で一意
// - 打ち消し: `overrides: <fork_id>.<key> = <value> | why: <理由>`(行頭の `- ` 可)。project.md(その repo だけ)と自分の節(下流にも)に書く。
//   名指せるのは祖先の節の (default) の鍵だけ。同じ project.md か同じ節で同じ対象を 2 回 = 失敗。勝ち負け(近い層が勝つ)は読み手の規則で、検査はしない
// - 接触(touchedOverrides)は /flux が取り込む前後の lineage.md で見る(.claude/skills/flux/lineage-touch.mjs)。自分の打ち消しが名指す鍵が変わったら止める
// - 書式(formatProblems)は pnpm check rules が全 repo で、並び・鍵・打ち消し(checkLineageStructure / checkOverrides)は pnpm workflow ownership check が fork で見る

import { FORK_ID_PATTERN } from "./forkIds.mjs";

export const LINEAGE_FILE = ".claude/rules/lineage.md";
export const PREAMBLE_END = "<!-- end preamble -->";

const HEADING = /^##\s+(.*?)\s*$/;
const SECTION_END = /^<!-- end (\S+) -->\s*$/;
const KEY_LINE = /^- ([A-Za-z0-9_-]+)( \(default\))?:(?:\s|$)/;
const OVERRIDE_LINE = /^(?:- )?overrides:\s*(.*)$/;
const OVERRIDE_BODY = /^([a-z0-9]+(?:-[a-z0-9]+)*)\.([A-Za-z0-9_-]+)\s*=\s*(.*?)\s*\|\s*why:\s*(.*?)\s*$/;

/**
 * overrides 行の中身を読む
 * @param {string} body `overrides:` の後ろ
 * @returns {{ owner: string, key: string, value: string, why: string } | { error: string }}
 */
export function parseOverrideBody(body) {
  const match = OVERRIDE_BODY.exec(body.trim());
  if (!match) return { error: `overrides: の形が違う(\`overrides: <fork_id>.<key> = <value> | why: <理由>\`): ${body.trim() || "(空)"}` };
  const [, owner, key, value, why] = match;
  if (value === "") return { error: `overrides: ${owner}.${key} の値が空` };
  if (why === "") return { error: `overrides: ${owner}.${key} に why: の理由が無い` };
  return { owner, key, value, why };
}

/**
 * 本文(project.md など)の overrides 行を集める
 * @param {string} text
 * @param {number} [offset] 行番号の始まり(1 始まりの行番号 = offset + 添字 + 1)
 * @returns {{ line: number, owner?: string, key?: string, value?: string, why?: string, error?: string }[]}
 */
export function parseOverrides(text, offset = 0) {
  const out = [];
  text.split("\n").forEach((line, index) => {
    const match = OVERRIDE_LINE.exec(line);
    if (match) out.push({ line: offset + index + 1, ...parseOverrideBody(match[1]) });
  });
  return out;
}

/**
 * lineage.md を読む
 * @param {string} text
 * @returns {{
 *   frontmatter: boolean,
 *   preambleEnds: number[],
 *   sections: { name: string, line: number, closed: boolean, keys: { key: string, isDefault: boolean, line: number, text: string }[], overrides: object[] }[],
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
      current = { name: heading[1], line: number, closed: false, keys: [], overrides: [] };
      sections.push(current);
      return;
    }
    if (current && !current.closed) {
      const end = SECTION_END.exec(line);
      if (end && end[1] === current.name) {
        current.closed = true;
        return;
      }
      const override = OVERRIDE_LINE.exec(line);
      if (override) {
        current.overrides.push({ line: number, ...parseOverrideBody(override[1]) });
        return;
      }
      const key = KEY_LINE.exec(line);
      if (key) current.keys.push({ key: key[1], isDefault: Boolean(key[2]), line: number, text: line });
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

/**
 * 打ち消しの検査(fork の pnpm workflow ownership check)
 * @param {{ parsed: ReturnType<typeof parseLineage>, projectText: string, own: string, projectFile?: string }} input
 * @returns {{ failures: string[], warnings: string[] }}
 */
export function checkOverrides({ parsed, projectText, own, projectFile = ".claude/rules/project.md" }) {
  const failures = [];
  const warnings = [];
  const ancestorKeys = new Map();
  for (const section of parsed.sections) {
    if (section.name !== own) ancestorKeys.set(section.name, new Map(section.keys.map((item) => [item.key, item])));
  }
  const checkSet = (where, overrides) => {
    const seen = new Map();
    for (const item of overrides) {
      if (item.error) {
        failures.push(`${where} ${item.line} 行目: ${item.error}`);
        continue;
      }
      const target = `${item.owner}.${item.key}`;
      if (seen.has(target)) failures.push(`${where} ${item.line} 行目: ${target} を 2 回打ち消している(${seen.get(target)} 行目)`);
      else seen.set(target, item.line);
      const keys = ancestorKeys.get(item.owner);
      if (!keys) {
        failures.push(`${where} ${item.line} 行目: ${target} の節 ${item.owner} が祖先に無い(名指すのは元の持ち主の fork_id)`);
        continue;
      }
      const key = keys.get(item.key);
      if (!key) failures.push(`${where} ${item.line} 行目: ${target} の鍵が節 ${item.owner} に無い`);
      else if (!key.isDefault) failures.push(`${where} ${item.line} 行目: ${target} は (default) でない(打ち消せない。変えたいなら /order ${item.owner})`);
    }
  };
  const projectOverrides = parseOverrides(projectText);
  checkSet(projectFile, projectOverrides);
  const ownSection = parsed.sections.find((section) => section.name === own);
  if (ownSection) checkSet(`${LINEAGE_FILE} の節 ${own}`, ownSection.overrides);

  const overridden = new Set(projectOverrides.filter((item) => !item.error).map((item) => item.key));
  const allAncestorKeys = new Set([...ancestorKeys.values()].flatMap((keys) => [...keys.keys()]));
  projectText.split("\n").forEach((line, index) => {
    const key = KEY_LINE.exec(line)?.[1];
    if (key && allAncestorKeys.has(key) && !overridden.has(key)) {
      warnings.push(`${projectFile} ${index + 1} 行目: 鍵 ${key} は祖先の lineage.md の鍵と同じ名前(変えるなら overrides: <fork_id>.${key} = … | why: …)`);
    }
  });
  return { failures, warnings };
}

/**
 * 取り込みで自分の打ち消しが名指す祖先の鍵が変わったか(/flux が人に確かめる)
 * @param {{ before: string | null, after: string | null, projectText: string, own: string }} input
 *   before / after = 取り込む前後の lineage.md(無ければ null)、projectText = 自分の project.md
 * @returns {{ target: string, where: string, change: "changed" | "removed" | "default-removed", before: string | null, after: string | null }[]}
 *   changed = 鍵の行の中身が変わった / removed = 鍵(か節)が消えた / default-removed = (default) が外れた(打ち消せなくなった)
 */
export function touchedOverrides({ before, after, projectText, own }) {
  const beforeParsed = parseLineage(before ?? "");
  const afterParsed = parseLineage(after ?? "");
  const keyOf = (parsed, owner, key) => parsed.sections.find((section) => section.name === owner)?.keys.find((item) => item.key === key) ?? null;
  const targets = [];
  for (const item of parseOverrides(projectText)) if (!item.error) targets.push({ ...item, where: ".claude/rules/project.md" });
  const ownSection = afterParsed.sections.find((section) => section.name === own) ?? beforeParsed.sections.find((section) => section.name === own);
  for (const item of ownSection?.overrides ?? []) if (!item.error) targets.push({ ...item, where: `${LINEAGE_FILE} の節 ${own}` });

  const touched = [];
  for (const { owner, key, where } of targets) {
    const was = keyOf(beforeParsed, owner, key);
    if (!was) continue; // 取り込む前から名指し先が無い = pnpm workflow ownership check が打ち消しの誤りとして出す
    const now = keyOf(afterParsed, owner, key);
    const change = !now ? "removed" : was.isDefault && !now.isDefault ? "default-removed" : was.text !== now.text ? "changed" : null;
    if (change) touched.push({ target: `${owner}.${key}`, where, change, before: was.text, after: now?.text ?? null });
  }
  return touched;
}
