// fork ID(fork の所有者 ID)の宣言の読み取り。git には触れず、ファイルを読むだけ。Node 組み込みだけで動く .mjs
// 仕様: ./README.md「fork ID の宣言」
//
// - 自分の ID: .claude/rules/project.md の `fork_id: <id>` の行(upstream = Tier1 は `fork_id: -`)
// - 親(上の Tier)の ID: .notices/applied/<id>.md の台帳名(/flux が取り込むたびに作り、子の fork にも受け継がれる)
// 宣言済みの ID = 自分 + 親。fork のドット名のファイル(src/wiring/<名前>.<fork ID>.ts 等)の検査が読む。

import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

export const PROJECT_RULES_FILE = ".claude/rules/project.md";
export const LEDGER_DIR = ".notices/applied";

/** fork ID に使える形(ドット名の区切りとぶつからないよう "." は使わない) */
export const FORK_ID_PATTERN = /^[A-Za-z0-9_-]+$/;

/**
 * project.md の本文から自分の fork ID を読む。宣言が無い・`-` なら null。形が不正なら error
 * @param {string} text project.md の中身
 * @returns {{ forkId: string | null, error: string | null }}
 */
export function parseForkIdDeclaration(text) {
  const lines = text.split("\n").filter((line) => /^fork_id:/.test(line));
  if (lines.length === 0) return { forkId: null, error: null };
  if (lines.length > 1) return { forkId: null, error: "fork_id: の行が 2 つ以上ある" };
  const value = lines[0].slice("fork_id:".length).trim().split(/\s+/)[0] ?? "";
  if (value === "" || value === "-") return { forkId: null, error: null };
  if (!FORK_ID_PATTERN.test(value)) return { forkId: null, error: `fork_id: ${value} は使えない形(英数字・_・- だけ)` };
  return { forkId: value, error: null };
}

/**
 * 宣言済みの fork ID を集める
 * @param {string} repoRoot リポジトリ直下
 * @returns {{ own: string | null, inherited: string[], all: string[], errors: string[] }}
 */
export function readDeclaredForkIds(repoRoot) {
  const errors = [];
  const rulesPath = join(repoRoot, PROJECT_RULES_FILE);
  const { forkId: own, error } = existsSync(rulesPath)
    ? parseForkIdDeclaration(readFileSync(rulesPath, "utf8"))
    : { forkId: null, error: null };
  if (error) errors.push(`${PROJECT_RULES_FILE}: ${error}`);

  const ledgerDir = join(repoRoot, LEDGER_DIR);
  const ledgerIds = existsSync(ledgerDir)
    ? readdirSync(ledgerDir)
        .filter((name) => name.endsWith(".md"))
        .map((name) => name.slice(0, -".md".length))
    : [];
  for (const id of ledgerIds) {
    if (!FORK_ID_PATTERN.test(id)) errors.push(`${LEDGER_DIR}/${id}.md: 台帳名が fork ID の形でない`);
  }
  const inherited = ledgerIds.filter((id) => id !== own && FORK_ID_PATTERN.test(id)).sort();
  const all = [...(own ? [own] : []), ...inherited];
  return { own, inherited, all, errors };
}

/**
 * fork のドット名 `<名前>[.<中置き>].<fork ID>.<拡張子>` を読む(src/wiring・src/proxies などの「fork はファイルを足すだけ」の置き場)。
 * 名前は英字始まりの英数字、fork ID は FORK_ID_PATTERN(ドットなし)。印の無い `<名前>.<拡張子>` は fork のファイルではない(null)
 * @param {string} fileName ファイル名(ディレクトリを含まない)
 * @param {{ infixes?: string[], extensions?: string[] }} [options] infixes = 名前と fork ID の間に置ける語(例 "client")、extensions = 受ける拡張子
 * @returns {{ name: string, infix: string | null, forkId: string } | null}
 */
export function parseForkDotName(fileName, { infixes = [], extensions = ["ts", "tsx"] } = {}) {
  const ext = extensions.map((e) => e.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|");
  const infix = infixes.length > 0 ? `(?:\\.(${infixes.join("|")}))?` : "()";
  const m = new RegExp(`^([A-Za-z][A-Za-z0-9]*)${infix}\\.([A-Za-z0-9_-]+)\\.(?:${ext})$`).exec(fileName);
  if (!m) return null;
  return { name: m[1], infix: m[2] || null, forkId: m[3] };
}
