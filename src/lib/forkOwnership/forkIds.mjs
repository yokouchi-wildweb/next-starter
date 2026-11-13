// fork の名前(リポの名前)の唯一の読み手。git には触れず、ファイルを読むだけ。Node 組み込みだけで動く .mjs
// 仕様: ./README.md「リポの名前と段(repo.json)」(D27・D30 K5・K6、指示書の議会 D44)
//
// - 自分の名前と段: リポ直下の repo.json(機械用の値のファイル)。平らな鍵を 1 鍵 1 行、値は文字列か真偽値だけ(入れ子・配列なし)
//   - repo_id = 自分の名前(全リポが書く。Tier1 = next-starter)。形 = 小文字・数字・ハイフン(FORK_ID_PATTERN)。無い・形違いは errors
//   - tier = root | middle | leaf(無い = leaf)。下流の有無はここから導く(root・middle = yes、leaf = none)
//   - agent.* = エージェントに任せる方針の鍵(devcheck が読む)。ほかの鍵は errors
//   - 読めない・無い repo.json は errors(検査は合格にしない、exit 2)
// - 祖先の名前: .notices/applied/<名前>.md の台帳名(自分を除く。/flux が取り込むたびに作り、子の fork にも受け継がれる)
// - Tier1 の判定: 自分の名前が src/lib/CATALOG.md の先頭の節の見出しと同じ。tier root と両向きで照らし、食い違えば downstreamError
// - 祖先と同名は errors: Tier1 の名前を名乗るのに自分の台帳がある(= fork)/ CATALOG の途中の節(中間 Tier)の名前を名乗る
// 台帳名・一時許可 .fork-ownership/<名前>.permits.txt・CATALOG の節の見出しはこの名前(受け口のファイル名には使わない、D137)。
// origin の URL からは導かない(導く実装は持たない)。
// - 古い形(.claude/rules/project.md の fork_id: / downstream: の行): 過去の版を読む所だけ forkIdOfTexts が読む(新を先に)
// - downstreamError = 段の宣言の誤り(errors と別。読むのは pnpm workflow ownership check と lineage.md の検査だけが未検証(exit 2)にし、
//   ビルド(pnpm check extensions)は止めない)

import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

export const REPO_JSON_FILE = "repo.json";
export const PROJECT_RULES_FILE = ".claude/rules/project.md";
export const LEDGER_DIR = ".notices/applied";
export const CATALOG_FILE = "src/lib/CATALOG.md";

/** fork の名前の形(小文字・数字・ハイフン。台帳・一時許可のファイル名になるので "." は使わない) */
export const FORK_ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

const SECTION_HEADING = /^##\s+(\S+)\s*$/gm;

/** 下流の有無の宣言の値(yes = 下流の fork を持つ・持つ予定がある、none = 末端) */
export const DOWNSTREAM_VALUES = ["yes", "none"];

/** 段(root = Tier1 / middle = 下流を持つ中間 / leaf = 末端)。無い = leaf */
export const TIER_VALUES = ["root", "middle", "leaf"];
export const DEFAULT_TIER = "leaf";

/** 段 → 下流の有無 */
export const downstreamOfTier = (tier) => (tier === "leaf" ? "none" : "yes");

/** repo.json の鍵の形(小文字の語を . でつなぐ)と、知っている鍵(agent.* は方針の鍵、ここでは形だけ見る) */
const REPO_KEY_PATTERN = /^[a-z][a-z0-9_]*(?:\.[a-z][a-z0-9_]*)*$/;
export const REPO_KEYS = ["repo_id", "tier"];
export const AGENT_KEY_PREFIX = "agent.";
export const isKnownRepoKey = (key) => REPO_KEYS.includes(key) || (key.startsWith(AGENT_KEY_PREFIX) && REPO_KEY_PATTERN.test(key));

/**
 * repo.json の本文を読む。平らな鍵・値は文字列か真偽値だけ・知っている鍵だけ。誤りは errors(読めた鍵は values に残す)
 * @param {string} text
 * @returns {{ values: Record<string, string | boolean>, errors: string[] }}
 */
export function parseRepoJson(text) {
  let data;
  try {
    data = JSON.parse(text);
  } catch (error) {
    return { values: {}, errors: [`JSON として読めない(${error.message})`] };
  }
  if (!data || typeof data !== "object" || Array.isArray(data)) return { values: {}, errors: ["JSON のオブジェクトでない"] };
  const values = {};
  const errors = [];
  for (const [key, value] of Object.entries(data)) {
    if (!isKnownRepoKey(key)) {
      errors.push(`知らない鍵 ${key}(使える鍵 = ${REPO_KEYS.join(" / ")} / agent.<種類>)`);
      continue;
    }
    if (typeof value !== "string" && typeof value !== "boolean") {
      errors.push(`${key} の値は文字列か真偽値だけ(入れ子・配列・数は使えない)`);
      continue;
    }
    values[key] = value;
  }
  return { values, errors };
}

/**
 * repo.json の名前と段。repo_id が無い・形違いは error、tier が無い = leaf、知らない値は tierError
 * @param {string} text
 * @returns {{ forkId: string | null, tier: "root" | "middle" | "leaf", error: string | null, tierError: string | null, values: Record<string, string | boolean>, errors: string[] }}
 */
export function parseRepoIdentity(text) {
  const { values, errors } = parseRepoJson(text);
  const id = values.repo_id;
  let error = null;
  if (id === undefined) error = "repo_id が無い(全リポが自分の名前を書く。Tier1 = next-starter)";
  else if (typeof id !== "string" || !FORK_ID_PATTERN.test(id)) error = `repo_id ${JSON.stringify(id)} は使えない形(小文字・数字・ハイフンだけ)`;
  const rawTier = values.tier ?? DEFAULT_TIER;
  const tierError = TIER_VALUES.includes(rawTier) ? null : `tier ${JSON.stringify(rawTier)} は使えない値(root / middle / leaf)`;
  const tier = tierError ? DEFAULT_TIER : rawTier;
  return { forkId: error ? null : id, tier, error, tierError, values, errors };
}

/**
 * 1 つの版の名前: repo.json を先に、無ければ古い形(project.md の fork_id:)。過去の版を読む所はこれだけを使う
 * @param {{ repoJson: string | null, projectMd: string | null }} texts その版のファイルの中身(無い = null)
 * @returns {{ forkId: string | null, error: string | null, source: "repo.json" | "project.md" | null }}
 */
export function forkIdOfTexts({ repoJson, projectMd }) {
  if (repoJson !== null && repoJson !== undefined) {
    const { forkId, error, errors } = parseRepoIdentity(repoJson);
    return { forkId, error: error ?? (errors.length ? errors.join(" / ") : null), source: "repo.json" };
  }
  if (projectMd !== null && projectMd !== undefined) {
    const { forkId, error } = parseForkIdDeclaration(projectMd);
    return { forkId, error, source: "project.md" };
  }
  return { forkId: null, error: `${REPO_JSON_FILE} も ${PROJECT_RULES_FILE} の fork_id: も無い`, source: null };
}

/**
 * 1 key 1 行の形で書く(リポの外の sh も grep で読める)
 * @param {Record<string, string | boolean>} values
 */
export const formatRepoJson = (values) => {
  const order = [...REPO_KEYS.filter((k) => k in values), ...Object.keys(values).filter((k) => !REPO_KEYS.includes(k)).sort()];
  return `{\n${order.map((k) => `  ${JSON.stringify(k)}: ${JSON.stringify(values[k])}`).join(",\n")}\n}\n`;
};

/** 行番号 index の行が属する ## 節の見出しの行番号(節の外 = -1) */
const sectionStartOf = (lines, index) => {
  for (let i = index; i >= 0; i -= 1) if (/^##\s/.test(lines[i])) return i;
  return -1;
};

/**
 * 古い形: project.md の本文から自分の名前を読む(過去の版・移しの命令だけ)。宣言が無い・`-`・形違いは error
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
 * 古い形: project.md の本文から下流の有無を読む(移しの命令だけ)。欠落・2 行以上・yes / none 以外・fork_id: と別の ## 節は error
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
 * 自分の名前・祖先の名前・Tier1 か・段と下流の有無を読む
 * @param {string} repoRoot リポジトリ直下
 * @returns {{ own: string | null, ancestors: string[], isTier1: boolean, tier: "root" | "middle" | "leaf", downstream: "yes" | "none" | null, downstreamError: string | null, errors: string[] }}
 *   downstreamError = 段の宣言の誤り(errors と別。読むのは pnpm workflow ownership check と lineage.md の検査だけ)
 */
export function readForkIdentity(repoRoot) {
  const errors = [];
  const repoPath = join(repoRoot, REPO_JSON_FILE);
  const repoText = existsSync(repoPath) ? readFileSync(repoPath, "utf8") : null;
  let own = null;
  let tier = DEFAULT_TIER;
  let tierError = null;
  if (repoText === null) {
    errors.push(`${REPO_JSON_FILE} が無い(リポ直下に {"repo_id": "<名前>", "tier": "root|middle|leaf"}。古い形からは pnpm workflow repo-json migrate)`);
  } else {
    const parsed = parseRepoIdentity(repoText);
    for (const e of parsed.errors) errors.push(`${REPO_JSON_FILE}: ${e}`);
    if (parsed.error) errors.push(`${REPO_JSON_FILE}: ${parsed.error}`);
    own = parsed.forkId;
    tier = parsed.tier;
    tierError = parsed.tierError;
  }

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
      errors.push(`${REPO_JSON_FILE}: repo_id ${own} は Tier1(${CATALOG_FILE} の先頭の節)と同じ名前なのに自分の台帳がある(祖先と違う名前にする)`);
    }
    const middle = sections.indexOf(own);
    if (middle > 0 && middle < sections.length - 1) {
      errors.push(`${REPO_JSON_FILE}: repo_id ${own} は ${CATALOG_FILE} の途中の節(祖先)と同じ名前(祖先と違う名前にする)`);
    }
  }
  // 段の見張り: tier root ⇔ 自分の名前が CATALOG の先頭の節(両向き)
  let downstreamError = tierError ? `${REPO_JSON_FILE}: ${tierError}` : null;
  if (!downstreamError && own !== null && repoText !== null) {
    if (tier === "root" && !isTier1) downstreamError = `${REPO_JSON_FILE}: tier root なのに repo_id ${own} が ${CATALOG_FILE} の先頭の節でない(Tier1 だけが root)`;
    else if (tier !== "root" && isTier1) downstreamError = `${REPO_JSON_FILE}: repo_id ${own} は ${CATALOG_FILE} の先頭の節(Tier1)なのに tier ${tier}(Tier1 は root)`;
  }
  const downstream = repoText === null || tierError ? null : downstreamOfTier(tier);
  return { own, ancestors, isTier1, tier, downstream, downstreamError, errors };
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
