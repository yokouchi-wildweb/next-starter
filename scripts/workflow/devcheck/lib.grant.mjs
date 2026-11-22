// scripts/workflow/devcheck/lib.grant.mjs
//
// 許可のフック(PreToolUse、hook.mjs)の判定。素の node で毎回動くので、tsx も重い import も使わない。
// 通すだけで止めない(D420): 命令の文字当ての止めは無い。本番の守りは入口(scripts/runner/guard が方針と 1 回分の許可で通す)、
// 人の決定を持つファイル(repo.json・.agent/devcheck-allow.json・.env.production*)は公式の .claude/settings.json の permissions.deny。
// 判定の順:
//   1. 1 回分の許可の道: devcheck danger <スイッチ名>(読むだけ)と、manual の通常の種類の devcheck run … --manual-go
//   2. 印(環境変数 DEVCHECK_GRANT=on)があり、その種類の方針が off でなく(manual は devcheck run … --manual-go だけ)、
//      許可してよい形のときだけ allow
//   3. それ以外・壊れた時(入力・方針・記録が読めない、例外)は何も返さない(= 普段どおり聞かれる)。方針 off も何も返さない
// 種類と方針は lib.kinds.mjs(devcheck の命令と同じ物)。入力の形の違いは adapt* で受ける(今は Claude Code の形だけ)
// 規則と使い方: scripts/workflow/devcheck/README.md「許可の層」

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

import { consumePermit, readPermit } from "./lib.allow.mjs";
import { KIND_NAMES, POLICY_KEYS, switchOf } from "./lib.kinds.mjs";

export const GRANT_ENV = "DEVCHECK_GRANT";
export const GRANT_ON = "on";

/** dev-tab の記録(URL の元)と、フックが最後に見た遷移先の記録(チェックアウトからの相対) */
export const DEV_TAB_STATE_FILE = ".agent/dev-tab.json";
export const BROWSER_STATE_FILE = ".agent/devcheck-browser.json";

/** Playwright MCP の道具名の頭と、どの形でも返さない道具(任意のコードの実行・ファイルの持ち出し) */
export const BROWSER_PREFIX = "mcp__playwright__browser_";
export const BROWSER_NEVER = ["browser_run_code_unsafe", "browser_evaluate", "browser_file_upload"];
/** 今のページが分からなくなる道具(返さず、最後に見た遷移先を消す) */
const BROWSER_LOSES_PAGE = ["browser_navigate_back", "browser_tabs"];
const LOCAL_HOSTS = ["localhost", "127.0.0.1"];

/** peer の送る・読む口(pnpm workflow peer <動作>) */
export const PEER_ACTIONS = ["send", "reply", "inbox", "read", "ack", "who"];

// ---- 入力の変換 ---------------------------------------------------------------------------

/**
 * @typedef {{ tool: string; command?: string; url?: string }} Request
 * 判定の入力。tool = 道具名、command = Bash の全文、url = 遷移先
 */

/**
 * Claude Code の PreToolUse の入力 → Request。読めない形は null
 * @param {any} input
 * @returns {Request | null}
 */
export const adaptClaude = (input) => {
  if (!input || typeof input !== "object" || typeof input.tool_name !== "string") return null;
  const ti = input.tool_input && typeof input.tool_input === "object" ? input.tool_input : {};
  /** @type {Request} */
  const req = { tool: input.tool_name };
  if (typeof ti.command === "string") req.command = ti.command;
  if (typeof ti.url === "string") req.url = ti.url;
  return req;
};

// ---- コマンドの読み ------------------------------------------------------------------------

/** シェルの語に分ける(引用符は外す)。読めない(閉じない引用符)は null */
export const shellWords = (/** @type {string} */ text) => {
  const words = [];
  let cur = "";
  let has = false;
  /** @type {string | null} */
  let quote = null;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quote) {
      if (c === quote) quote = null;
      else if (c === "\\" && quote === '"' && i + 1 < text.length) cur += text[++i];
      else cur += c;
    } else if (c === "'" || c === '"') {
      quote = c;
      has = true;
    } else if (c === "\\" && i + 1 < text.length) {
      cur += text[++i];
      has = true;
    } else if (/\s/.test(c)) {
      if (has) words.push(cur);
      cur = "";
      has = false;
    } else {
      cur += c;
      has = true;
    }
  }
  if (quote) return null;
  if (has) words.push(cur);
  return words;
};

/**
 * @typedef {{ decision: "deny" | "allow"; reason: string }} Decision
 */

// ---- 2. 許可してよい形 --------------------------------------------------------------------

/**
 * シェルの記号があるか(つなぐ・流す・置き換え・リダイレクト・変数・改行・グロブ)。
 * '…' の中は文字だけ、"…" の中は $ と ` だけを見る(SQL の括弧などは通す)。閉じない引用符も記号ありとみなす
 */
export const hasShellSymbols = (/** @type {string} */ command) => {
  /** @type {string | null} */
  let quote = null;
  for (let i = 0; i < command.length; i++) {
    const c = command[i];
    if (quote === "'") {
      if (c === "'") quote = null;
    } else if (quote === '"') {
      if (c === '"') quote = null;
      else if (c === "\\") i++;
      else if (c === "$" || c === "`") return true;
    } else if (c === "'" || c === '"') quote = c;
    else if (c === "\\") return true;
    else if (/[;&|<>`$\n\r(){}*?[\]!~#]/.test(c)) return true;
  }
  return quote !== null;
};

/**
 * @typedef {{ kind: string; manualGo?: boolean; always?: boolean; ship?: boolean }} Match
 * kind = 方針の鍵 / always = 方針を見ない(devcheck の plan / status / cleanup) / ship = 出荷の検査の命令(pnpm test・pnpm check、方針の鍵なしで通す)
 */

/**
 * Bash の形 → 種類。許可してよい形でなければ null
 * @param {string} command
 * @param {(name: string) => string | null} itemKind fork の項目の名前 → 種類(無い・読めない = null)
 * @returns {Match | null}
 */
export const classifyBash = (command, itemKind) => {
  if (hasShellSymbols(command)) return null;
  const words = shellWords(command.trim());
  if (!words || words.length < 2 || words[0] !== "pnpm") return null;
  let rest = words.slice(1);
  if (rest[0] === "-s" || rest[0] === "--silent") rest = rest.slice(1);
  const [a, b, c] = rest;
  if (a === "workflow" && b === "devcheck") {
    if (["plan", "status"].includes(c) && rest.slice(3).every((w) => w === "--json")) return { kind: "devcheck", always: true };
    if (c === "cleanup" && rest.length === 3) return { kind: "devcheck", always: true };
    // danger = 読むだけ(今その危険な種類にできること)。allow(1 回分の許可を書く)は通さない = 普段どおり聞かれる(人に見える)
    if (c === "danger" && rest.length === 4 && /^[a-z]+$/.test(rest[3])) return { kind: "devcheck", always: true };
    if (c === "run" && rest[3]) {
      const name = rest[3];
      const manualGo = rest.slice(4).includes("--manual-go");
      if (KIND_NAMES.includes(name)) return name === "browser" ? null : { kind: name, manualGo };
      if (!/^[a-z0-9][a-z0-9-]*$/.test(name)) return null;
      const kind = itemKind(name);
      return kind && KIND_NAMES.includes(kind) ? { kind, manualGo } : null;
    }
    return null;
  }
  if (a === "workflow" && b === "dev-tab" && c === "run") {
    const tail = rest.slice(3);
    const ok = tail.every((w, i) => ["start", "stop", "status", "--background"].includes(w) || w === "--port" || /^--port=\d+$/.test(w) || (/^\d+$/.test(w) && tail[i - 1] === "--port"));
    return ok ? { kind: "server" } : null;
  }
  if (a === "workflow" && b === "dev-admin" && c === "run") return rest.slice(3).every((w) => w === "--check") ? { kind: "login" } : null;
  if (a === "workflow" && b === "peer" && PEER_ACTIONS.includes(c)) return { kind: "peer" };
  // 検査(出荷の道具の中の命令)は許可で開け閉めしない(D272): 方針の鍵なしで通す。回す所は core/notices.md checks_in_ship
  if (a === "test") return rest.slice(1).some((w) => w === "--db" || w.startsWith("--db=")) ? null : { kind: "ship-check", ship: true };
  if (a === "check") return { kind: "ship-check", ship: true };
  return null;
};

/**
 * @typedef {{
 *   grant: boolean;
 *   policy: () => Record<string, string>;
 *   permit?: () => { switches: string[] } | null;
 *   consume?: (sw: string) => void;
 *   itemKind: (name: string) => string | null;
 *   devOrigin: () => string | null;
 *   lastPage: () => string | null;
 *   setLastPage: (origin: string | null) => void;
 * }} Deps
 * policy = 方針を読む(読めない = 例外 → 何も返さない)/ devOrigin = dev-tab の記録の URL の origin(無い = null)/
 * lastPage・setLastPage = フックが最後に見た遷移先の origin
 */

/** URL → origin(localhost / 127.0.0.1 の http だけ。ほかは null) */
export const localOrigin = (/** @type {string} */ url) => {
  try {
    const u = new URL(url);
    if (u.protocol !== "http:" || !LOCAL_HOSTS.includes(u.hostname)) return null;
    return `http://localhost:${u.port || "80"}`;
  } catch {
    return null;
  }
};

/**
 * ブラウザの道具 → 種類 browser か null。遷移は見た先を記録する(印があるときだけ呼ばれる)
 * @param {Request} req @param {Deps} deps
 * @returns {Match | null}
 */
export const classifyBrowser = (req, deps) => {
  const name = req.tool.slice("mcp__playwright__".length);
  if (BROWSER_NEVER.includes(name)) return null;
  if (BROWSER_LOSES_PAGE.includes(name)) {
    deps.setLastPage(null);
    return null;
  }
  const dev = deps.devOrigin();
  if (name === "browser_navigate") {
    const target = typeof req.url === "string" ? localOrigin(req.url) : null;
    deps.setLastPage(target);
    return dev && target === dev ? { kind: "browser" } : null;
  }
  if (name === "browser_install") return null;
  return dev && deps.lastPage() === dev ? { kind: "browser" } : null;
};

/**
 * 判定の本体。deny / allow / null(何も返さない)
 * @param {Request} req @param {Deps} deps
 * @returns {Decision | null}
 */
/** 打った命令(引用符を外した語を空白 1 つでつなぐ)。シェルの記号があれば null */
const plainCommand = (/** @type {string} */ command) => {
  if (hasShellSymbols(command)) return null;
  const words = shellWords(command.trim());
  return words && words.length ? words.join(" ") : null;
};

/**
 * 1 回分の許可の道(D123): devcheck danger <スイッチ名>(読むだけ)と、方針が manual の通常の種類の devcheck run … --manual-go を、
 * そのスイッチの許可がある時だけ通す(run は使ったら消す)。印(DEVCHECK_GRANT)は要らない(人の 1 回の言葉だから)。
 * 危険な 3 つの命令そのものは照らさない: 許可を読んで使うのは入口(scripts/runner/guard・pnpm ops vercel、D420)。当たらなければ null
 * @param {Request} req @param {Deps} deps
 * @returns {Decision | null}
 */
export const permitDecision = (req, deps) => {
  if (req.tool !== "Bash" || typeof req.command !== "string" || !deps.permit) return null;
  const permit = deps.permit();
  if (!permit || permit.switches.length === 0) return null;
  const command = plainCommand(req.command);
  if (!command) return null;
  const policy = deps.policy();
  // 許可のある危険な種類の danger(読むだけ、許可は使わない)は印が無くても通す(/allow の流れの途中で止まらないように)
  const dangerRead = /^pnpm (?:-s )?workflow devcheck danger ([a-z]+)$/.exec(command);
  if (dangerRead && permit.switches.includes(dangerRead[1])) return { decision: "allow", reason: `devcheck の 1 回の許可: ${dangerRead[1]} の danger(読むだけ)` };
  const match = classifyBash(req.command, deps.itemKind);
  if (match && !match.always && match.manualGo && policy[match.kind] === "manual") {
    const sw = switchOf(match.kind);
    if (sw && permit.switches.includes(sw)) {
      deps.consume?.(sw);
      return { decision: "allow", reason: `devcheck の 1 回の許可: ${sw}(${match.kind}=manual)` };
    }
  }
  return null;
};

/**
 * 判定の本体。deny / allow / null(何も返さない)
 * @param {Request} req @param {Deps} deps
 * @returns {Decision | null}
 */
export const decide = (req, deps) => {
  const permitted = permitDecision(req, deps);
  if (permitted) return permitted;
  if (!deps.grant) return null;
  /** @type {Match | null} */
  let match = null;
  if (req.tool === "Bash" && typeof req.command === "string") match = classifyBash(req.command, deps.itemKind);
  else if (req.tool.startsWith(BROWSER_PREFIX)) match = classifyBrowser(req, deps);
  if (!match) return null;
  if (match.ship) return { decision: "allow", reason: "devcheck の許可: 印あり・出荷の検査の命令(方針の鍵なし、回す所は checks_in_ship)" };
  const policy = deps.policy();
  // devcheck の入口(plan / status / cleanup・allow / danger)は種類を持たない: どれかの種類が off でない間だけ通す
  // (全体のスイッチ enabled:false = 全部 off → 印の道では何も通さない、D103)
  if (match.always) return POLICY_KEYS.some((k) => policy[k] !== undefined && policy[k] !== "off") ? { decision: "allow", reason: "devcheck の許可: 印あり・devcheck の入口" } : null;
  // manual は印の道では通さない(1 回分の許可の道だけ)
  if (policy[match.kind] === "auto") return { decision: "allow", reason: `devcheck の許可: 印あり・方針 ${match.kind}=auto` };
  return null;
};

// ---- 環境に触る部品(hook.mjs が使う) ------------------------------------------------------

/** @param {string} file */
const readJsonOrNull = (file) => {
  try {
    return JSON.parse(readFileSync(file, "utf8"));
  } catch {
    return null;
  }
};

/**
 * 実際の Deps。projectDir = フックの動くチェックアウト / toolDir = この道具のフォルダ(方針・項目)
 * @param {{ projectDir: string; toolDir: string; env: NodeJS.ProcessEnv; policy: Record<string, string> | null }} o
 * @returns {Deps}
 */
export const realDeps = ({ projectDir, toolDir, env, policy }) => ({
  grant: env[GRANT_ENV] === GRANT_ON,
  policy: () => {
    if (!policy) throw new Error("方針が読めない");
    return policy;
  },
  permit: () => readPermit(projectDir),
  consume: (sw) => consumePermit(projectDir, sw),
  itemKind: (name) => {
    const data = readJsonOrNull(path.join(toolDir, "items", `${name}.json`));
    return data && typeof data.kind === "string" ? data.kind : null;
  },
  devOrigin: () => {
    const state = readJsonOrNull(path.join(projectDir, DEV_TAB_STATE_FILE));
    return state && Number.isInteger(state.port) ? `http://localhost:${state.port}` : null;
  },
  lastPage: () => {
    const state = readJsonOrNull(path.join(projectDir, BROWSER_STATE_FILE));
    return state && typeof state.origin === "string" ? state.origin : null;
  },
  setLastPage: (origin) => {
    const file = path.join(projectDir, BROWSER_STATE_FILE);
    if (!existsSync(path.dirname(file))) mkdirSync(path.dirname(file), { recursive: true });
    writeFileSync(file, `${JSON.stringify({ origin, at: new Date().toISOString() })}\n`);
  },
});

/**
 * 判定 → Claude Code のフックの出力(JSON 1 行)。null = 何も出さない
 * @param {Decision | null} decision
 */
export const toClaudeOutput = (decision) =>
  decision
    ? JSON.stringify({ hookSpecificOutput: { hookEventName: "PreToolUse", permissionDecision: decision.decision, permissionDecisionReason: decision.reason } })
    : "";

/** 方針が要る判定か(印あり・止めなし・形が当たる時だけ方針を読む = 普段のフックを軽く保つ) */
export const needsPolicy = (/** @type {Request} */ req, /** @type {Deps} */ deps) => {
  // 1 回分の許可がある間は Bash の判定に方針が要る(許可の道)
  if (req.tool === "Bash" && deps.permit?.()) return true;
  if (!deps.grant) return false;
  return req.tool === "Bash" || req.tool.startsWith(BROWSER_PREFIX);
};
