// fork の名前(fork ID)の唯一の読み手。git には触れず、ファイルを読むだけ。Node 組み込みだけで動く .mjs
// 仕様: ./README.md「fork ID の宣言」(D27・D30 K5・K6)
//
// - 自分の名前: .claude/rules/project.md の `fork_id: <名前>` の 1 行。全リポ(Tier1 も)が書く。Tier1 = next-starter。
//   形 = 小文字・数字・ハイフン(FORK_ID_PATTERN)。`-`(旧 Tier1 の印)・宣言なし・形違いは errors(検査は合格にしない、exit 2)
// - 祖先の名前: .notices/applied/<名前>.md の台帳名(自分を除く。/flux が取り込むたびに作り、子の fork にも受け継がれる)
// - Tier1 の判定: 自分の名前が src/lib/CATALOG.md の先頭の節の見出しと同じ
// - 祖先と同名は errors: Tier1 の名前を名乗るのに自分の台帳がある(= fork)/ CATALOG の途中の節(中間 Tier)の名前を名乗る
// 台帳名・一時許可 .fork-ownership/<名前>.permits.txt・CATALOG の節の見出し・ドット名 <項目>.<名前>.ts はこの名前。
// origin の URL からは導かない(導く実装は持たない)。

import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

export const PROJECT_RULES_FILE = ".claude/rules/project.md";
export const LEDGER_DIR = ".notices/applied";
export const CATALOG_FILE = "src/lib/CATALOG.md";

/** fork の名前の形(小文字・数字・ハイフン。ドット名の区切りとぶつからないよう "." は使わない) */
export const FORK_ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

const SECTION_HEADING = /^##\s+(\S+)\s*$/gm;

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

/** CATALOG.md の節の見出し(上流から順、先頭 = Tier1) */
export function catalogSectionNames(text) {
  return [...text.matchAll(SECTION_HEADING)].map((match) => match[1]);
}

/**
 * 自分の名前・祖先の名前・Tier1 かを読む
 * @param {string} repoRoot リポジトリ直下
 * @returns {{ own: string | null, ancestors: string[], isTier1: boolean, errors: string[] }}
 */
export function readForkIdentity(repoRoot) {
  const errors = [];
  const rulesPath = join(repoRoot, PROJECT_RULES_FILE);
  const { forkId: own, error } = existsSync(rulesPath)
    ? parseForkIdDeclaration(readFileSync(rulesPath, "utf8"))
    : { forkId: null, error: `${PROJECT_RULES_FILE} が無い` };
  if (error) errors.push(`${PROJECT_RULES_FILE}: ${error}`);

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
  return { own, ancestors, isTier1, errors };
}

/**
 * 宣言済みの名前を集める(ドット名の検査が読む: 自分 + 祖先)
 * @param {string} repoRoot リポジトリ直下
 * @returns {{ own: string | null, inherited: string[], all: string[], errors: string[] }}
 */
export function readDeclaredForkIds(repoRoot) {
  const { own, ancestors, errors } = readForkIdentity(repoRoot);
  return { own, inherited: ancestors, all: [...(own ? [own] : []), ...ancestors], errors };
}

/**
 * fork のドット名 `<名前>[.<中置き>].<fork ID>.<拡張子>` を読む(src/wiring・src/proxies などの「fork はファイルを足すだけ」の置き場)。
 * 名前は英字始まりの英数字、fork ID は FORK_ID_PATTERN(小文字・数字・ハイフン、ドットなし)。印の無い `<名前>.<拡張子>` は fork のファイルではない(null)
 * @param {string} fileName ファイル名(ディレクトリを含まない)
 * @param {{ infixes?: string[], extensions?: string[] }} [options] infixes = 名前と fork ID の間に置ける語(例 "client")、extensions = 受ける拡張子
 * @returns {{ name: string, infix: string | null, forkId: string } | null}
 */
export function parseForkDotName(fileName, { infixes = [], extensions = ["ts", "tsx"] } = {}) {
  const ext = extensions.map((e) => e.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|");
  const infix = infixes.length > 0 ? `(?:\\.(${infixes.join("|")}))?` : "()";
  const m = new RegExp(`^([A-Za-z][A-Za-z0-9]*)${infix}\\.([a-z0-9]+(?:-[a-z0-9]+)*)\\.(?:${ext})$`).exec(fileName);
  if (!m) return null;
  return { name: m[1], infix: m[2] || null, forkId: m[3] };
}
