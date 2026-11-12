// scripts/workflow/devcheck/lib.kinds.mjs
//
// 種類と方針の唯一の置き場(素の ESM)。devcheck の命令(lib.ts が型を付けて出し直す)と、許可のフック(lib.grant.mjs、
// tsx なしの node で毎回動く)の両方がここを読む。別の対応表を作らない。
// - KINDS: やることの種類と打つコマンドの形(上流のコード。スキーマ push・本番は種類に無い)
// - HOOK_KINDS: 許可のフックだけが使う種類(devcheck の候補には出ない)。peer = pnpm workflow peer の送る・読む口
// - 方針: policy.json(上流の実体、全部 auto)に policy.override.ts(fork、上流は出さない)の宣言した鍵(POLICY_KEYS と全体のスイッチ enabled)だけを重ねる
// 規則と使い方: scripts/workflow/devcheck/README.md

import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

export class DevcheckError extends Error {
  /** @param {string} message */
  constructor(message) {
    super(message);
    this.name = "DevcheckError";
  }
}

/**
 * やることの種類と打つコマンドの形。スキーマの push(db:push)・本番(--env production / --confirm)は種類に無い(D51・D58)。
 * DB に書く種類は guard を通る入口(pnpm ops db inspect query: 書く入口として guard を通り、既定は開発、本番は確認が要る)を
 * --env を付けずに使う。command: null = 命令ではなくエージェントが道具で行う / writes = 何かを書くか(DB・ファイル・プロセス)
 */
export const KINDS = {
  server: { what: "開発サーバーを立てる(動いていれば使う)", command: "pnpm workflow dev-tab run", writes: true },
  browser: { what: "動いているアプリをブラウザで見る(Playwright MCP、エージェントが行う)", command: null, writes: false },
  login: { what: "確認用の管理者を用意してログイン情報を得る", command: "pnpm workflow dev-admin run", writes: true },
  "db-write": { what: "開発の DB に行を書く(作った行は片付けで消す)", command: 'pnpm ops db inspect query "<SQL>"', writes: true },
  "db-delete": { what: "開発の DB の行を消す", command: 'pnpm ops db inspect query "<SQL>"', writes: true },
  "env-add": { what: "開発の env(.env.development)に値を足す(値は表示しない)", command: null, writes: true },
  test: { what: "テストを走らせる", command: "pnpm test <path>", writes: false },
  check: { what: "検査を走らせる", command: "pnpm check <target>", writes: false },
};

export const KIND_NAMES = Object.keys(KINDS);

/** 許可のフックだけの種類(devcheck の計画の候補には出さない)。方針の鍵は持つ(fork が off にできる) */
export const HOOK_KINDS = ["peer"];

/** 方針の鍵 = 種類 + フックだけの種類 */
export const POLICY_KEYS = [...KIND_NAMES, ...HOOK_KINDS];

export const POLICY_VALUES = ["auto", "manual", "off"];

/** 方針の全体のスイッチ(D103)。false = 全部の種類(peer も)を off とみなす(種類ごとの値より強い)。無い = true */
export const POLICY_SWITCH = "enabled";

/** 方針の実体(印なし)と、その一部を重ねる上書き(<対象>.override.ts、export const override = { … }) */
export const POLICY_FILE = "policy.json";
export const POLICY_OVERRIDE_FILE = "policy.override.ts";

/** @param {unknown} data @param {string} file */
const checkPolicyObject = (data, file) => {
  if (!data || typeof data !== "object" || Array.isArray(data)) throw new DevcheckError(`${file}: 種類 → auto | manual | off の JSON オブジェクトにする`);
  /** @type {Record<string, string | boolean>} */
  const out = {};
  for (const [key, value] of Object.entries(data)) {
    if (key === POLICY_SWITCH) {
      if (typeof value !== "boolean") throw new DevcheckError(`${file}: ${POLICY_SWITCH} の値 ${JSON.stringify(value)} は true / false のどちらか`);
      out[key] = value;
      continue;
    }
    if (!POLICY_KEYS.includes(key)) throw new DevcheckError(`${file}: 宣言に無い鍵 ${key}(重ねてよい鍵 = ${POLICY_SWITCH} と種類 ${POLICY_KEYS.join(" / ")})`);
    if (!POLICY_VALUES.includes(/** @type {string} */ (value))) throw new DevcheckError(`${file}: ${key} の値 ${JSON.stringify(value)} は auto / manual / off のどれか`);
    out[key] = /** @type {string} */ (value);
  }
  return out;
};

/**
 * 実体に fork の上書きの宣言した鍵だけを重ねる(上書きは無くてよい)。宣言に無い鍵・値の誤りは DevcheckError。
 * 返すのは効いている種類ごとの値: 全体のスイッチ enabled が false なら全部 off(種類ごとの値より強い)
 * @param {unknown} defaults @param {unknown | null} override
 * @returns {Record<string, string>}
 */
export const mergePolicy = (defaults, override) => {
  const base = checkPolicyObject(defaults, POLICY_FILE);
  for (const key of POLICY_KEYS) if (!base[key]) throw new DevcheckError(`${POLICY_FILE}: ${key} がありません`);
  const over = override === null ? {} : checkPolicyObject(override, POLICY_OVERRIDE_FILE);
  const merged = { ...base, ...over };
  const enabled = merged[POLICY_SWITCH] !== false;
  return Object.fromEntries(POLICY_KEYS.map((key) => [key, enabled ? /** @type {string} */ (merged[key]) : "off"]));
};

/** @param {string} file */
const readJson = (file) => {
  try {
    return JSON.parse(readFileSync(file, "utf8"));
  } catch (error) {
    throw new DevcheckError(`${path.basename(file)} が読めません: ${/** @type {Error} */ (error).message}`);
  }
};

/**
 * 上書きのファイル(policy.override.ts)の `override` を読む。無い・空(空白とコメントだけ)= 不在(null)。
 * 隣に実体(policy.json)が無い上書きは孤立 = DevcheckError。export が無い・オブジェクトでない = DevcheckError。
 * tsx の下でも素の node(型を外して読む)でも読める
 * @param {string} dir
 * @returns {Promise<unknown | null>}
 */
export const readOverride = async (dir) => {
  const file = path.join(dir, POLICY_OVERRIDE_FILE);
  if (!existsSync(file)) return null;
  const text = readFileSync(file, "utf8").replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, "").trim();
  if (text === "") return null;
  if (!existsSync(path.join(dir, POLICY_FILE))) throw new DevcheckError(`${POLICY_OVERRIDE_FILE}: 隣に実体 ${POLICY_FILE} が無い(重ねる相手が無い上書き)`);
  /** @type {Record<string, unknown>} */
  let mod;
  try {
    mod = await import(pathToFileURL(file).href);
  } catch (error) {
    throw new DevcheckError(`${POLICY_OVERRIDE_FILE} が読めません: ${/** @type {Error} */ (error).message}`);
  }
  if (!("override" in mod)) throw new DevcheckError(`${POLICY_OVERRIDE_FILE}: export const override = { 種類: "auto" | "manual" | "off" } の形にする`);
  return mod.override;
};

/**
 * この道具のフォルダから方針を読む: 実体(policy.json)+ 上書き(policy.override.ts)の宣言した鍵だけ
 * @param {string} dir
 * @returns {Promise<Record<string, string>>}
 */
export const loadPolicy = async (dir) => {
  const override = await readOverride(dir);
  const body = path.join(dir, POLICY_FILE);
  if (!existsSync(body)) throw new DevcheckError(`${POLICY_FILE} が無い`);
  return mergePolicy(readJson(body), override);
};
