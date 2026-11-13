// scripts/workflow/repo-json/lib.mjs
//
// pnpm workflow repo-json の部品。リポ直下の repo.json(機械用の値: 名前・段・エージェントに任せる方針)を読む・書く。
// 形と読み手は src/lib/forkOwnership/forkIds.mjs(parseRepoJson・formatRepoJson)。ここは書く側だけを持つ。
// - set: 鍵と値を読み手の決まりで確かめ、1 鍵 1 行の形で書き直す
// - migrate: 古い形(.claude/rules/project.md の fork_id: / downstream: の 2 行)を repo.json へ移し、2 行を消す。
//   downstream: が無い・読めない時は止める(--tier で人が決める)
// 規則と使い方: scripts/workflow/repo-json/README.md

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

import {
  CATALOG_FILE,
  PROJECT_RULES_FILE,
  REPO_JSON_FILE,
  TIER_VALUES,
  catalogSectionNames,
  formatRepoJson,
  isKnownRepoKey,
  parseDownstreamDeclaration,
  parseForkIdDeclaration,
  parseRepoIdentity,
  parseRepoJson,
} from "../../../src/lib/forkOwnership/forkIds.mjs";

export class RepoJsonError extends Error {
  /** @param {string} message */
  constructor(message) {
    super(message);
    this.name = "RepoJsonError";
  }
}

/** @param {string} root */
const repoFile = (root) => path.join(root, REPO_JSON_FILE);

/**
 * 今の repo.json の値(無い = 空)。読めない形は RepoJsonError(何も書かない)
 * @param {string} root
 * @returns {Record<string, string | boolean>}
 */
export const readValues = (root) => {
  const file = repoFile(root);
  if (!existsSync(file)) return {};
  const { values, errors } = parseRepoJson(readFileSync(file, "utf8"));
  if (errors.length) throw new RepoJsonError(`${REPO_JSON_FILE}: ${errors.join(" / ")}(直してからもう一度)`);
  return values;
};

/**
 * 値の文字列を型にする: true / false = 真偽値、ほか = 文字列
 * @param {string} raw
 */
export const parseValue = (raw) => (raw === "true" ? true : raw === "false" ? false : raw);

/**
 * 1 つの鍵を書く(読み手の決まりで確かめる)。書いた後の値を返す
 * @param {string} root @param {string} key @param {string} raw
 */
export const setValue = (root, key, raw) => {
  if (!isKnownRepoKey(key)) throw new RepoJsonError(`知らない鍵 ${key}(使える鍵 = repo_id / tier / agent.<種類>)`);
  const values = { ...readValues(root), [key]: parseValue(raw) };
  const text = formatRepoJson(values);
  const parsed = parseRepoIdentity(text);
  if (key === "repo_id" && parsed.error) throw new RepoJsonError(parsed.error);
  if (key === "tier" && parsed.tierError) throw new RepoJsonError(parsed.tierError);
  if (parsed.errors.length) throw new RepoJsonError(parsed.errors.join(" / "));
  writeFileSync(repoFile(root), text);
  return values;
};

/**
 * 古い形から移す。{ values, removedLines } を返す
 * @param {string} root
 * @param {{ tier?: string | null, dryRun?: boolean }} options
 */
export const migrate = (root, { tier = null, dryRun = false } = {}) => {
  const rulesPath = path.join(root, PROJECT_RULES_FILE);
  if (!existsSync(rulesPath)) throw new RepoJsonError(`${PROJECT_RULES_FILE} が無い(移すものが無い。pnpm workflow repo-json set repo_id <名前> で書く)`);
  const text = readFileSync(rulesPath, "utf8");
  const { forkId, error } = parseForkIdDeclaration(text);
  const current = readValues(root);
  const id = forkId ?? (typeof current.repo_id === "string" ? current.repo_id : null);
  if (!id) throw new RepoJsonError(`${PROJECT_RULES_FILE}: ${error}`);
  let nextTier = tier;
  if (nextTier !== null && !TIER_VALUES.includes(nextTier)) throw new RepoJsonError(`--tier ${nextTier} は使えない値(root / middle / leaf)`);
  if (nextTier === null) {
    const declared = parseDownstreamDeclaration(text);
    if (declared.error) {
      if (typeof current.tier === "string") nextTier = current.tier;
      else throw new RepoJsonError(`${PROJECT_RULES_FILE}: ${declared.error}。段を決めて --tier root|middle|leaf を付ける(下流の fork を持つなら middle、Tier1 は root、末端は leaf)`);
    } else {
      const catalog = path.join(root, CATALOG_FILE);
      const first = existsSync(catalog) ? catalogSectionNames(readFileSync(catalog, "utf8"))[0] : undefined;
      nextTier = declared.downstream === "none" ? "leaf" : first === id ? "root" : "middle";
    }
  }
  const values = { ...current, repo_id: id, tier: nextTier };
  const lines = text.split("\n");
  const removedLines = lines.filter((line) => /^(fork_id|downstream):/.test(line));
  if (!dryRun) {
    writeFileSync(repoFile(root), formatRepoJson(values));
    if (removedLines.length) writeFileSync(rulesPath, lines.filter((line) => !/^(fork_id|downstream):/.test(line)).join("\n"));
  }
  return { values, removedLines };
};

/** 動作の外枠: RepoJsonError は 1 行で exit 2 */
export const runAction = (/** @type {(args: string[]) => void} */ fn) => {
  try {
    fn(process.argv.slice(2));
  } catch (error) {
    if (error instanceof RepoJsonError) {
      console.error(`repo-json: ${error.message}`);
      process.exit(2);
    }
    throw error;
  }
};
