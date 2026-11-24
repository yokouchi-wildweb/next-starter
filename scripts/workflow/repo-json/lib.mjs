// scripts/workflow/repo-json/lib.mjs
//
// pnpm workflow repo-json の部品。リポ直下の repo.json(機械用の値: 名前・段・エージェントに任せる方針)を読む・書く。
// 形と読み手は src/lib/forkOwnership/forkIds.mjs(parseRepoJson・formatRepoJson)。ここは書く側だけを持つ。
// - set: 点の道の鍵(agent.server・agent.entries.deploy・vercel.plan)と値を読み手の決まりで確かめ、入れ子の形(1 鍵 1 行)で書き直す /
//   unset: 1 つの鍵を消す(repo_id・tier は消せない)
// - migrate: 古い形を移す。(1) 平らな repo.json(一番上の点の入った鍵)を入れ子へ(入口の鍵 agent.<種類>.entry → agent.entries.<種類>、
//   agent.deploy.db_entry → agent.entries.deploy_db、廃止した agent.check・agent.test は落とす、知らない鍵は止める)
//   (2) .claude/rules/project.md の fork_id: / downstream: の 2 行を repo.json へ移し、2 行を消す(downstream: が無い・読めない時は止める、--tier)
// 規則と使い方: scripts/workflow/repo-json/README.md

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

import {
  CATALOG_FILE,
  PROJECT_RULES_FILE,
  REPO_JSON_FILE,
  REPO_FIXED_KEYS,
  REPO_KEYS,
  TIER_VALUES,
  catalogSectionNames,
  formatRepoJson,
  isKnownRepoKey,
  parseDownstreamDeclaration,
  parseForkIdDeclaration,
  parseRepoIdentity,
  parseRepoJson,
} from "../../../src/lib/forkOwnership/node.mjs";

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
  if (!isKnownRepoKey(key)) throw new RepoJsonError(`知らない鍵 ${key}(使える鍵 = repo_id / tier / agent.<種類> / agent.entries.<種類> / vercel.plan)`);
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
 * 1 つの鍵を消す(set の対。廃止した方針の鍵を fork の repo.json から外す時など)。repo_id・tier は消せない。
 * 無い鍵は何もしない。消した後の値と、消したかを返す
 * @param {string} root @param {string} key
 * @returns {{ values: Record<string, string | boolean>, removed: boolean }}
 */
export const unsetValue = (root, key) => {
  if (REPO_FIXED_KEYS.includes(key)) throw new RepoJsonError(`${key} は消せない(どのリポも持つ鍵。変えるのは set)`);
  if (!isKnownRepoKey(key)) throw new RepoJsonError(`知らない鍵 ${key}(使える鍵 = ${REPO_KEYS.join(" / ")} / agent.<種類> / agent.entries.<種類>)`);
  const current = readValues(root);
  if (!(key in current)) return { values: current, removed: false };
  const { [key]: _, ...values } = current;
  writeFileSync(repoFile(root), formatRepoJson(values));
  return { values, removed: true };
};

/** 平らな形の鍵の移し先(入口の鍵の改名、D312)。null = 落とす(廃止した鍵) */
export const FLAT_RENAMES = {
  "agent.db_push.entry": "agent.entries.db_push",
  "agent.env_production.entry": "agent.entries.env_production",
  "agent.deploy.entry": "agent.entries.deploy",
  "agent.deploy.db_entry": "agent.entries.deploy_db",
  "agent.check": null,
  "agent.test": null,
};

/**
 * 平らな repo.json の本文を点の道の表へ(入れ子の組はそのまま混ぜる)。知らない鍵は止める
 * @param {string} text
 * @returns {{ values: Record<string, string | boolean>, renamed: string[], dropped: string[], flat: boolean }}
 */
export const flatToValues = (text) => {
  let data;
  try {
    data = JSON.parse(text);
  } catch (error) {
    throw new RepoJsonError(`${REPO_JSON_FILE}: JSON として読めない(${error instanceof Error ? error.message : String(error)})`);
  }
  if (!data || typeof data !== "object" || Array.isArray(data)) throw new RepoJsonError(`${REPO_JSON_FILE}: JSON のオブジェクトでない`);
  const flatKeys = Object.keys(data).filter((k) => k.includes("."));
  const nested = Object.fromEntries(Object.entries(data).filter(([k]) => !k.includes(".")));
  const base = parseRepoJson(JSON.stringify(nested));
  if (base.errors.length) throw new RepoJsonError(`${REPO_JSON_FILE}: ${base.errors.join(" / ")}`);
  /** @type {Record<string, string | boolean>} */
  const values = { ...base.values };
  /** @type {string[]} */
  const renamed = [];
  /** @type {string[]} */
  const dropped = [];
  for (const key of flatKeys) {
    const value = data[key];
    if (key in FLAT_RENAMES) {
      const to = FLAT_RENAMES[/** @type {keyof typeof FLAT_RENAMES} */ (key)];
      if (to === null) {
        dropped.push(key);
        continue;
      }
      values[to] = value;
      renamed.push(`${key} → ${to}`);
    } else if (isKnownRepoKey(key) && (typeof value === "string" || typeof value === "boolean")) values[key] = value;
    else throw new RepoJsonError(`${REPO_JSON_FILE}: 知らない鍵 ${key}(移し先が無い。消すか直してからもう一度。何も書いていない)`);
  }
  return { values, renamed, dropped, flat: flatKeys.length > 0 };
};

/**
 * 古い形から移す(平らな repo.json → 入れ子、project.md の 2 行 → repo.json)。2 回目は何も書かない
 * @param {string} root
 * @param {{ tier?: string | null, dryRun?: boolean }} options
 * @returns {{ values: Record<string, string | boolean>, removedLines: string[], renamed: string[], dropped: string[], wrote: boolean }}
 */
export const migrate = (root, { tier = null, dryRun = false } = {}) => {
  const file = repoFile(root);
  const rulesPath = path.join(root, PROJECT_RULES_FILE);
  const repoText = existsSync(file) ? readFileSync(file, "utf8") : null;
  const flat = repoText === null ? { values: {}, renamed: [], dropped: [], flat: false } : flatToValues(repoText);
  const text = existsSync(rulesPath) ? readFileSync(rulesPath, "utf8") : null;
  const hasOldLines = text !== null && /^(fork_id|downstream):/m.test(text);
  if (!hasOldLines && repoText === null) {
    if (text === null) throw new RepoJsonError(`${PROJECT_RULES_FILE} が無い(移すものが無い。pnpm workflow repo-json set repo_id <名前> で書く)`);
    const { error } = parseForkIdDeclaration(text);
    throw new RepoJsonError(`${PROJECT_RULES_FILE}: ${error}`);
  }
  const current = flat.values;
  let values = current;
  /** @type {string[]} */
  let removedLines = [];
  if (hasOldLines && text !== null) {
    const { forkId, error } = parseForkIdDeclaration(text);
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
    values = { ...current, repo_id: id, tier: nextTier };
    removedLines = text.split("\n").filter((line) => /^(fork_id|downstream):/.test(line));
  }
  const out = formatRepoJson(values);
  const check = parseRepoJson(out);
  if (check.errors.length) throw new RepoJsonError(`${REPO_JSON_FILE}: ${check.errors.join(" / ")}(何も書いていない)`);
  const wrote = out !== repoText || removedLines.length > 0;
  if (!dryRun && wrote) {
    if (out !== repoText) writeFileSync(file, out);
    if (removedLines.length && text !== null) writeFileSync(rulesPath, text.split("\n").filter((line) => !/^(fork_id|downstream):/.test(line)).join("\n"));
  }
  return { values, removedLines, renamed: flat.renamed, dropped: flat.dropped, wrote };
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
