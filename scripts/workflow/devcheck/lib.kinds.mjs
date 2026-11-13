// scripts/workflow/devcheck/lib.kinds.mjs
//
// 種類と方針の唯一の置き場(素の ESM)。devcheck の命令(lib.ts が型を付けて出し直す)と、許可のフック(lib.grant.mjs、
// tsx なしの node で毎回動く)の両方がここを読む。別の対応表を作らない。
// - KINDS: やることの種類と打つコマンドの形(上流のコード。スキーマ push・本番は種類に無い)
// - HOOK_KINDS: 許可のフックだけが使う種類(devcheck の候補には出ない)。peer = pnpm workflow peer の送る・読む口
// - 方針: リポ直下の repo.json の agent.* の鍵(種類・peer・全体のスイッチ enabled・危険な 3 つと入口)。種類と既定値はこのファイル(上流のコード)
// 規則と使い方: scripts/workflow/devcheck/README.md

import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

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

/**
 * 危険な 3 つ(D115・D116)。値は off | manual だけ(auto・知らない値は off とみなす)、既定 off。
 * 入口の命令(agent.<種類>.entry)は fork が差し替えられる。"-" = 上流の入口なし(fork が自分の命令を書く)
 * - db_push = 開発の DB の反映だけ / env_production = 本番の env を書く / deploy = 本番へ出す(本番の DB の反映も、agent.deploy.db_entry)
 */
export const DANGER_KINDS = {
  db_push: { what: "開発の DB にスキーマを反映する", entries: { entry: "pnpm db:push" } },
  env_production: { what: "本番の env(.env.production)を書く", entries: { entry: "-" } },
  deploy: { what: "本番へ出す(本番の DB の反映を含む)", entries: { entry: "pnpm live", db_entry: "pnpm db:push -- --env production" } },
};
export const DANGER_NAMES = Object.keys(DANGER_KINDS);
export const DANGER_VALUES = ["off", "manual"];

/** 方針の全体のスイッチ(D103)。false = 全部の種類(peer・危険な 3 つも)を off とみなす(種類ごとの値より強い)。無い = true */
export const POLICY_SWITCH = "enabled";

/** 方針の置き場: リポ直下の repo.json の agent.* の鍵(読み手は src/lib/forkOwnership/forkIds.mjs の parseRepoJson) */
export const POLICY_FILE = "repo.json";
export const AGENT_PREFIX = "agent.";

/** 種類の名前 → repo.json の鍵(db-write → agent.db_write) */
export const policyKeyOf = (kind) => `${AGENT_PREFIX}${kind.replace(/-/g, "_")}`;

/** 宣言した鍵の全部(種類・peer・全体のスイッチ・危険な 3 つと入口) */
export const declaredAgentKeys = () => [
  ...POLICY_KEYS.map(policyKeyOf),
  `${AGENT_PREFIX}${POLICY_SWITCH}`,
  ...DANGER_NAMES.flatMap((d) => [policyKeyOf(d), ...Object.keys(DANGER_KINDS[d].entries).map((e) => `${policyKeyOf(d)}.${e}`)]),
];

/**
 * repo.json の値 → 効いている方針。通常の種類は auto | manual | off(既定 auto、誤りは DevcheckError)、
 * enabled は真偽値(既定 true、誤りは DevcheckError)、危険な 3 つは off | manual(既定 off、ほかは off)、入口は文字列(既定は上流の命令)。
 * 宣言に無い agent.* の鍵は DevcheckError
 * @param {Record<string, string | boolean>} values
 * @returns {{ policy: Record<string, string>, entries: Record<string, Record<string, string>>, enabled: boolean }}
 */
export const agentPolicyOf = (values) => {
  const declared = declaredAgentKeys();
  for (const key of Object.keys(values)) {
    if (key.startsWith(AGENT_PREFIX) && !declared.includes(key)) throw new DevcheckError(`${POLICY_FILE}: 宣言に無い鍵 ${key}(使える鍵 = ${declared.join(" / ")})`);
  }
  const enabledRaw = values[`${AGENT_PREFIX}${POLICY_SWITCH}`];
  if (enabledRaw !== undefined && typeof enabledRaw !== "boolean") throw new DevcheckError(`${POLICY_FILE}: ${AGENT_PREFIX}${POLICY_SWITCH} の値 ${JSON.stringify(enabledRaw)} は true / false のどちらか`);
  const enabled = enabledRaw !== false;
  /** @type {Record<string, string>} */
  const policy = {};
  for (const kind of POLICY_KEYS) {
    const key = policyKeyOf(kind);
    const raw = values[key] ?? "auto";
    if (!POLICY_VALUES.includes(/** @type {string} */ (raw))) throw new DevcheckError(`${POLICY_FILE}: ${key} の値 ${JSON.stringify(raw)} は auto / manual / off のどれか`);
    policy[kind] = enabled ? /** @type {string} */ (raw) : "off";
  }
  /** @type {Record<string, Record<string, string>>} */
  const entries = {};
  for (const d of DANGER_NAMES) {
    const raw = values[policyKeyOf(d)];
    policy[d] = enabled && raw === "manual" ? "manual" : "off";
    entries[d] = {};
    for (const [e, def] of Object.entries(DANGER_KINDS[d].entries)) {
      const key = `${policyKeyOf(d)}.${e}`;
      const v = values[key] ?? def;
      if (typeof v !== "string" || v.trim() === "") throw new DevcheckError(`${POLICY_FILE}: ${key} は命令の文字列(上流の入口なしは "-")`);
      entries[d][e] = v.trim();
    }
  }
  return { policy, entries, enabled };
};

/**
 * チェックアウトの repo.json から方針を読む(無い = 全部既定)。repo.json が読めない・形の誤りは DevcheckError
 * @param {string} root
 * @returns {Promise<{ policy: Record<string, string>, entries: Record<string, Record<string, string>>, enabled: boolean }>}
 */
export const readAgentPolicy = async (root) => {
  const file = path.join(root, POLICY_FILE);
  if (!existsSync(file)) return agentPolicyOf({});
  const { parseRepoJson } = await import("../../../src/lib/forkOwnership/forkIds.mjs");
  const { values, errors } = parseRepoJson(readFileSync(file, "utf8"));
  if (errors.length) throw new DevcheckError(`${POLICY_FILE}: ${errors.join(" / ")}`);
  return agentPolicyOf(values);
};

/**
 * 効いている方針(種類 → auto | manual | off、危険な 3 つも)
 * @param {string} root チェックアウトの直下
 * @returns {Promise<Record<string, string>>}
 */
export const loadPolicy = async (root) => (await readAgentPolicy(root)).policy;
