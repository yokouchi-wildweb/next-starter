// fork の名前(fork ID)の唯一の読み手。git には触れず、ファイルを読むだけ。Node 組み込みだけで動く .mjs
// 仕様: ./README.md「fork ID の宣言」(D27・D30 K5・K6)
//
// - 自分の名前: .claude/rules/project.md の `fork_id: <名前>` の 1 行。全リポ(Tier1 も)が書く。Tier1 = next-starter。
//   形 = 小文字・数字・ハイフン(FORK_ID_PATTERN)。`-`(旧 Tier1 の印)・宣言なし・形違いは errors(検査は合格にしない、exit 2)
// - 祖先の名前: .notices/applied/<名前>.md の台帳名(自分を除く。/flux が取り込むたびに作り、子の fork にも受け継がれる)
// - Tier1 の判定: 自分の名前が src/lib/CATALOG.md の先頭の節の見出しと同じ
// - 祖先と同名は errors: Tier1 の名前を名乗るのに自分の台帳がある(= fork)/ CATALOG の途中の節(中間 Tier)の名前を名乗る
// 台帳名・一時許可 .fork-ownership/<名前>.permits.txt・CATALOG の節の見出しはこの名前(受け口のファイル名には使わない、D137)。
// origin の URL からは導かない(導く実装は持たない)。
// - 下流の有無: project.md の `downstream: yes|none` の 1 行(fork_id: と同じ ## 節)。読み手はここだけ(/ship・/flux・
//   lineage.md の検査もこの値を使う)。欠落・2 行以上・yes / none 以外・fork_id: と別の節は downstreamError。
//   errors には入れない: pnpm workflow ownership check と lineage.md の検査だけが未検証(exit 2)にし、ビルド(pnpm check extensions)は止めない

import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

export const PROJECT_RULES_FILE = ".claude/rules/project.md";
export const LEDGER_DIR = ".notices/applied";
export const CATALOG_FILE = "src/lib/CATALOG.md";

/** fork の名前の形(小文字・数字・ハイフン。台帳・一時許可のファイル名になるので "." は使わない) */
export const FORK_ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

const SECTION_HEADING = /^##\s+(\S+)\s*$/gm;

/** 下流の有無の宣言の値(yes = 下流の fork を持つ・持つ予定がある、none = 末端) */
export const DOWNSTREAM_VALUES = ["yes", "none"];

/** 行番号 index の行が属する ## 節の見出しの行番号(節の外 = -1) */
const sectionStartOf = (lines, index) => {
  for (let i = index; i >= 0; i -= 1) if (/^##\s/.test(lines[i])) return i;
  return -1;
};

/**
 * project.md の本文から自分の名前を読む。宣言が無い・`-`・形違いは error
 * @param {string} text project.md の中身
 * @returns {{ forkId: string | null, error: string | null }}
 */
export function parseForkIdDeclaration(text) {
  const lines = text.split("\n").filter((line) => /^fork_id:/.test(line));
  if (lines.length === 0) return { forkId: null, error: "fork_id: の行が無い(全リポが自分の名前を 1 行で宣言する。Tier1 = next-starter)" };
  if (lines.length > 1) return { forkId: null, error: "fork_id: の行が 2 つ以上ある" };
  const value = lines[0].slice("fork_id:".length).trim().split(/\s+/)[0] ?? "";
  if (value === "" || value === "-") return { forkId: null, error: `fork_id: ${value || "(空)"} は使えない(\`-\` の印は廃止。自分の名前を書く)` };
  if (!FORK_ID_PATTERN.test(value)) return { forkId: null, error: `fork_id: ${value} は使えない形(小文字・数字・ハイフンだけ)` };
  return { forkId: value, error: null };
}

/**
 * project.md の本文から下流の有無を読む。欠落・2 行以上・yes / none 以外・fork_id: と別の ## 節は error
 * @param {string} text project.md の中身
 * @returns {{ downstream: "yes" | "none" | null, error: string | null }}
 */
export function parseDownstreamDeclaration(text) {
  const lines = text.split("\n");
  const at = lines.flatMap((line, index) => (/^downstream:/.test(line) ? [index] : []));
  if (at.length === 0) return { downstream: null, error: "downstream: の行が無い(fork_id: と同じ節に downstream: yes|none を 1 行。下流の fork を持つなら yes)" };
  if (at.length > 1) return { downstream: null, error: "downstream: の行が 2 つ以上ある" };
  const value = lines[at[0]].slice("downstream:".length).trim().split(/\s+/)[0] ?? "";
  if (!DOWNSTREAM_VALUES.includes(value)) return { downstream: null, error: `downstream: ${value || "(空)"} は使えない値(yes か none)` };
  const forkIdAt = lines.findIndex((line) => /^fork_id:/.test(line));
  if (forkIdAt !== -1 && sectionStartOf(lines, forkIdAt) !== sectionStartOf(lines, at[0])) {
    return { downstream: null, error: "downstream: が fork_id: と別の節にある(同じ節に置く)" };
  }
  return { downstream: /** @type {"yes" | "none"} */ (value), error: null };
}

/** CATALOG.md の節の見出し(上流から順、先頭 = Tier1) */
export function catalogSectionNames(text) {
  return [...text.matchAll(SECTION_HEADING)].map((match) => match[1]);
}

/**
 * 自分の名前・祖先の名前・Tier1 か・下流の有無を読む
 * @param {string} repoRoot リポジトリ直下
 * @returns {{ own: string | null, ancestors: string[], isTier1: boolean, downstream: "yes" | "none" | null, downstreamError: string | null, errors: string[] }}
 *   downstreamError = downstream: の宣言の誤り(errors と別。読むのは pnpm workflow ownership check と lineage.md の検査だけ)
 */
export function readForkIdentity(repoRoot) {
  const errors = [];
  const rulesPath = join(repoRoot, PROJECT_RULES_FILE);
  const rulesText = existsSync(rulesPath) ? readFileSync(rulesPath, "utf8") : null;
  const { forkId: own, error } = rulesText !== null ? parseForkIdDeclaration(rulesText) : { forkId: null, error: `${PROJECT_RULES_FILE} が無い` };
  if (error) errors.push(`${PROJECT_RULES_FILE}: ${error}`);
  const declared = rulesText !== null ? parseDownstreamDeclaration(rulesText) : { downstream: null, error: null };
  const downstreamError = declared.error ? `${PROJECT_RULES_FILE}: ${declared.error}` : null;

  const ledgerDir = join(repoRoot, LEDGER_DIR);
  const ledgerIds = existsSync(ledgerDir)
    ? readdirSync(ledgerDir)
        .filter((name) => name.endsWith(".md"))
        .map((name) => name.slice(0, -".md".length))
    : [];
  for (const id of ledgerIds) {
    if (!FORK_ID_PATTERN.test(id)) errors.push(`${LEDGER_DIR}/${id}.md: 台帳名が fork の名前の形でない(改名は notice の手順)`);
  }
  const ancestors = ledgerIds.filter((id) => id !== own && FORK_ID_PATTERN.test(id)).sort();

  const catalogPath = join(repoRoot, CATALOG_FILE);
  const sections = existsSync(catalogPath) ? catalogSectionNames(readFileSync(catalogPath, "utf8")) : [];
  const isTier1 = own !== null && sections[0] === own;
  if (own !== null) {
    if (isTier1 && ledgerIds.includes(own)) {
      errors.push(`${PROJECT_RULES_FILE}: fork_id: ${own} は Tier1(${CATALOG_FILE} の先頭の節)と同じ名前なのに自分の台帳がある(祖先と違う名前にする)`);
    }
    const middle = sections.indexOf(own);
    if (middle > 0 && middle < sections.length - 1) {
      errors.push(`${PROJECT_RULES_FILE}: fork_id: ${own} は ${CATALOG_FILE} の途中の節(祖先)と同じ名前(祖先と違う名前にする)`);
    }
  }
  return { own, ancestors, isTier1, downstream: declared.downstream, downstreamError, errors };
}

/**
 * 宣言済みの名前を集める(自分 + 祖先)
 * @param {string} repoRoot リポジトリ直下
 * @returns {{ own: string | null, inherited: string[], all: string[], errors: string[] }}
 */
export function readDeclaredForkIds(repoRoot) {
  const { own, ancestors, errors } = readForkIdentity(repoRoot);
  return { own, inherited: ancestors, all: [...(own ? [own] : []), ...ancestors], errors };
}
