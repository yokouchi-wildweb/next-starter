// scripts/workflow/devcheck/lib.grant.mjs
//
// 許可のフック(PreToolUse、hook.mjs)の判定。素の node で毎回動くので、tsx も重い import も使わない。
// 判定の順(D66):
//   1. 固定の止め(印・方針・モードと独立。D58・D67): スキーマの反映 / 本番の確認の自動の付け足し / 本番の env への書き込み → deny
//      (理由と人が手で打つ形を 1 行で)。repo.json の直接の書き換えも同じ止め方(書くのは pnpm workflow repo-json set)。
//      読む・探すだけ(grep など)は止めない
//   2. 印(環境変数 DEVCHECK_GRANT=on)があり、その種類の方針が off でなく(manual は devcheck run … --manual-go だけ)、
//      許可してよい形のときだけ allow
//   3. それ以外・壊れた時(入力・方針・記録が読めない、例外)は何も返さない(= 普段どおり聞かれる)。方針 off も何も返さない
// 種類と方針は lib.kinds.mjs(devcheck の命令と同じ物)。入力の形の違いは adapt* で受ける(今は Claude Code の形だけ)
// 規則と使い方: scripts/workflow/devcheck/README.md「許可の層」

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

import { consumePermit, PERMIT_FILE, readPermit } from "./lib.allow.mjs";
import { DANGER_NAMES, KIND_NAMES, POLICY_KEYS, switchOf } from "./lib.kinds.mjs";

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
 * @typedef {{ tool: string; command?: string; file?: string; url?: string }} Request
 * 判定の入力。tool = 道具名、command = Bash の全文、file = 書く先のパス、url = 遷移先
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
  const file = ti.file_path ?? ti.notebook_path;
  if (typeof file === "string") req.file = file;
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

/** 頭の環境変数の代入と、前に付くだけの語(sudo・env・time など)を外す */
const stripPrefix = (/** @type {string[]} */ words) => {
  let i = 0;
  while (i < words.length && (/^[A-Za-z_][A-Za-z0-9_]*=/.test(words[i]) || ["sudo", "env", "time", "exec", "command", "nohup"].includes(words[i]))) i++;
  return words.slice(i);
};

/** 中身をシェルとして動かす語(heredoc の本文・-c の引数を命令として読む) */
const SHELLS = ["bash", "sh", "zsh", "dash"];

/** text[open] = "(" に対応する ")" の位置(無ければ末尾) */
const matchParen = (/** @type {string} */ text, /** @type {number} */ open) => {
  let depth = 0;
  for (let i = open; i < text.length; i++) {
    if (text[i] === "(") depth++;
    else if (text[i] === ")" && --depth === 0) return i;
  }
  return text.length;
};

/** 文字列の中の置き換え($( … ) と ` … `)の中身 */
const substitutionsIn = (/** @type {string} */ text) => {
  const out = [];
  for (let i = 0; i < text.length; i++) {
    if (text[i] === "$" && text[i + 1] === "(") {
      const end = matchParen(text, i + 1);
      out.push(text.slice(i + 2, end));
      i = end;
    } else if (text[i] === "`") {
      const end = text.indexOf("`", i + 1);
      out.push(text.slice(i + 1, end < 0 ? text.length : end));
      i = end < 0 ? text.length : end;
    }
  }
  return out;
};

/**
 * @typedef {{ words: string[]; writes: string[] }} ShellCommand
 * words = 語(引用符を外した)/ writes = 書き出しのリダイレクトの行き先(> >> >| &>)
 */

/**
 * 止めを探すための読み: Bash の全文 → 実際に動く命令の列。
 * 引用符の外のつなぐ・流す記号で切り、引用符の中は文字として扱う(コミットの文などに書いた語では止めない)。
 * 動く物は中まで読む: $( … ) と ` … `(引用符 "…" の中も)、bash -c の引数・eval、シェルに渡す heredoc の本文、
 * 引用符の無い区切りの heredoc の本文の中の置き換え
 * @param {string} text
 * @returns {ShellCommand[]}
 */
export const parseCommands = (text, depth = 0) => {
  /** @type {ShellCommand[]} */
  const out = [];
  if (depth > 4) return out;
  /** @type {string[]} */
  let words = [];
  /** @type {string[]} */
  let writes = [];
  let cur = "";
  let has = false;
  /** @type {false | "out" | "in"} */
  let redirect = false;
  /** @type {{ delim: string; quoted: boolean; head: string }[]} */
  const heredocs = [];
  const sub = (/** @type {string} */ inner) => out.push(...parseCommands(inner, depth + 1));
  const endWord = () => {
    if (has) {
      if (redirect === "out") writes.push(cur);
      else if (redirect !== "in") words.push(cur);
      redirect = false;
    }
    cur = "";
    has = false;
  };
  const endCommand = () => {
    endWord();
    redirect = false;
    if (words.length || writes.length) {
      out.push({ words, writes });
      const w = stripPrefix(words);
      const c = w.indexOf("-c");
      if (SHELLS.includes(w[0] ?? "") && c >= 0 && w[c + 1]) sub(w[c + 1]);
      if (w[0] === "eval") sub(w.slice(1).join(" "));
    }
    words = [];
    writes = [];
  };
  let i = 0;
  while (i < text.length) {
    const c = text[i];
    if (c === "'") {
      const j = text.indexOf("'", i + 1);
      cur += text.slice(i + 1, j < 0 ? text.length : j);
      has = true;
      i = j < 0 ? text.length : j + 1;
    } else if (c === '"') {
      let j = i + 1;
      while (j < text.length && text[j] !== '"') {
        if (text[j] === "\\") {
          cur += text[j + 1] ?? "";
          j += 2;
        } else if (text[j] === "$" && text[j + 1] === "(") {
          const end = matchParen(text, j + 1);
          sub(text.slice(j + 2, end));
          j = end + 1;
        } else if (text[j] === "`") {
          const end = text.indexOf("`", j + 1);
          sub(text.slice(j + 1, end < 0 ? text.length : end));
          j = end < 0 ? text.length : end + 1;
        } else cur += text[j++];
      }
      has = true;
      i = j + 1;
    } else if (c === "\\") {
      if (text[i + 1] !== "\n") cur += text[i + 1] ?? "";
      has = has || text[i + 1] !== "\n";
      i += 2;
    } else if (c === "$" && text[i + 1] === "(") {
      const end = matchParen(text, i + 1);
      sub(text.slice(i + 2, end));
      has = true;
      i = end + 1;
    } else if (c === "`") {
      const end = text.indexOf("`", i + 1);
      sub(text.slice(i + 1, end < 0 ? text.length : end));
      has = true;
      i = end < 0 ? text.length : end + 1;
    } else if (c === "<" && text[i + 1] === "<" && text[i + 2] !== "<") {
      endWord();
      let j = i + 2;
      if (text[j] === "-") j++;
      while (text[j] === " " || text[j] === "\t") j++;
      let delim = "";
      let quoted = false;
      while (j < text.length && !/[\s;&|<>()]/.test(text[j])) {
        if (text[j] === "'" || text[j] === '"' || text[j] === "\\") quoted = true;
        else delim += text[j];
        j++;
      }
      heredocs.push({ delim, quoted, head: stripPrefix(words)[0] ?? "" });
      i = j;
    } else if (c === "\n") {
      endCommand();
      i++;
      for (const h of heredocs) {
        const lines = [];
        while (i < text.length) {
          let nl = text.indexOf("\n", i);
          if (nl < 0) nl = text.length;
          const line = text.slice(i, nl);
          i = nl + 1;
          if (line.replace(/^\t+/, "") === h.delim) break;
          lines.push(line);
        }
        const body = lines.join("\n");
        if (SHELLS.includes(h.head)) sub(body);
        else if (!h.quoted) for (const inner of substitutionsIn(body)) sub(inner);
      }
      heredocs.length = 0;
    } else if (c === "&" && text[i + 1] === ">") {
      endWord();
      redirect = "out";
      i += text[i + 2] === ">" ? 3 : 2;
    } else if (c === ">" || c === "<") {
      if (c === ">" && has && /^\d+$/.test(cur)) {
        cur = "";
        has = false;
      } else endWord();
      let j = i + 1;
      if (c === ">" && (text[j] === ">" || text[j] === "|")) j++;
      if (text[j] === "&") {
        // >&2 などは記述子の複製(行き先はファイルでない)
        j++;
        while (/[0-9-]/.test(text[j] ?? "")) j++;
        i = j;
        continue;
      }
      redirect = c === ">" ? "out" : "in";
      i = j;
    } else if (";&|()".includes(c)) {
      endCommand();
      i++;
    } else if (/\s/.test(c)) {
      endWord();
      i++;
    } else {
      cur += c;
      has = true;
      i++;
    }
  }
  endCommand();
  return out;
};

const PACKAGE_RUNNERS = ["pnpm", "npm", "yarn", "bun", "npx", "pnpx"];
const SCRIPT_RUNNERS = [...PACKAGE_RUNNERS, "node", "tsx", "deno"];

const isProdEnvPath = (/** @type {string} */ p) => /^\.env\.production/.test(path.basename(p.replace(/['"]/g, "")));
/** 書く物を守るファイル: 本番の env と repo.json(方針の置き場。書くのは pnpm workflow repo-json set と /repo-policy だけ) */
const isRepoJsonPath = (/** @type {string} */ p) => path.basename(p.replace(/['"]/g, "")) === "repo.json";
/** 1 回分の許可の記録(書くのは pnpm workflow devcheck allow だけ) */
const isPermitPath = (/** @type {string} */ p) => path.basename(p.replace(/['"]/g, "")) === path.basename(PERMIT_FILE);
const isGuardedPath = (/** @type {string} */ p) => isProdEnvPath(p) || isRepoJsonPath(p) || isPermitPath(p);
/** 守るファイルへの書き込みの止め(理由と人がすること) */
const guardedDeny = (/** @type {string} */ p) => {
  const name = path.basename(String(p).replace(/^of=/, "").replace(/['"]/g, ""));
  if (isRepoJsonPath(name)) return deny("repo.json(名前・段・方針)は直接書き換えない", "pnpm workflow repo-json set <鍵> <値> か /repo-policy");
  if (isPermitPath(name)) return deny("1 回分の許可の記録は直接書き換えない", "/allow <スイッチ名>");
  return deny(`本番の env(${name})はエージェントが書かない`, `エディタで ${name} を直す`);
};

// ---- 1. 固定の止め ------------------------------------------------------------------------

/**
 * @typedef {{ decision: "deny" | "allow"; reason: string }} Decision
 */

/** @param {string} reason @param {string} human @returns {Decision} */
const deny = (reason, human) => ({ decision: "deny", reason: `devcheck の固定の止め: ${reason}。人が手で打つ: ${human}` });

/**
 * 固定の止め 3 つ。印・方針・モードと独立に見る。当たらなければ null
 * (D59 の明示の指示の印は、ここが deny を返す前に見る形で足す)
 * @param {Request} req
 * @returns {Decision | null}
 */
export const fixedStop = (req) => {
  if (["Edit", "Write", "MultiEdit", "NotebookEdit"].includes(req.tool) && req.file && isGuardedPath(req.file)) {
    return guardedDeny(req.file);
  }
  if (req.tool !== "Bash" || typeof req.command !== "string") return null;
  for (const cmd of parseCommands(req.command)) {
    // 本番の env への書き込み(リダイレクト)
    const written = cmd.writes.find(isGuardedPath);
    if (written) return guardedDeny(written);
    const words = stripPrefix(cmd.words);
    const head = words[0] ?? "";
    // スキーマの反映(db:push:check は読むだけなので通す)
    if (PACKAGE_RUNNERS.includes(head)) {
      const schema = words.find((w) => /^db:(push|migrate)(:.*)?$/.test(w) && w !== "db:push:check");
      if (schema) return deny("スキーマの反映(push / migrate)は人の手で", `pnpm ${schema}`);
      const dk = words.indexOf("drizzle-kit");
      if (dk >= 0 && ["push", "migrate", "drop", "up"].includes(words[dk + 1] ?? "")) return deny("スキーマの反映(drizzle-kit)は人の手で", `pnpm db:push`);
    }
    if (head === "drizzle-kit" && ["push", "migrate", "drop", "up"].includes(words[1] ?? "")) return deny("スキーマの反映(drizzle-kit)は人の手で", `pnpm db:push`);
    // 本番の確認の自動の付け足し
    if (SCRIPT_RUNNERS.includes(head)) {
      const i = words.findIndex((w, n) => w === "--confirm=production" || (w === "--confirm" && words[n + 1] === "production"));
      if (i >= 0) return deny("本番の確認(--confirm=production)はエージェントが付けない", `${words.filter((w, n) => !(n === i || (words[i] === "--confirm" && n === i + 1))).join(" ")}(TTY で production と打つ)`);
    }
    // 本番の env への書き込み(コマンド)
    const args = words.slice(1).filter((w) => !w.startsWith("-"));
    const target =
      (head === "tee" && args.find(isGuardedPath)) ||
      (["cp", "mv", "install", "ln"].includes(head) && args.length > 0 && isGuardedPath(args[args.length - 1]) && args[args.length - 1]) ||
      (["sed", "perl"].includes(head) && words.some((w) => /^(-i|--in-place)/.test(w) || /^-[A-Za-z]*i/.test(w)) && args.find(isGuardedPath)) ||
      (["rm", "truncate", "shred", "unlink"].includes(head) && args.find(isGuardedPath)) ||
      (head === "dd" && words.find((w) => w.startsWith("of=") && isGuardedPath(w.slice(3))));
    if (target) return guardedDeny(target);
  }
  return null;
};

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
 * @typedef {{ kind: string; manualGo?: boolean; always?: boolean }} Match
 * kind = 方針の鍵 / always = 方針を見ない(devcheck の plan / status / cleanup)
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
  if (a === "test") return rest.slice(1).some((w) => w === "--db" || w.startsWith("--db=")) ? null : { kind: "test" };
  if (a === "check") return { kind: "check" };
  return null;
};

/**
 * @typedef {{
 *   grant: boolean;
 *   policy: () => Record<string, string>;
 *   entries?: () => Record<string, Record<string, string>>;
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
 * 危険な種類の入口の命令の形(許可の 1 回で通す形)。consumes = その形で許可を使い切るか
 * @param {string} kind @param {Record<string, string>} entry
 * @returns {{ command: string, consumes: boolean }[]}
 */
export const dangerForms = (kind, entry) => {
  const forms = [];
  const e = entry.entry;
  if (e && e !== "-") {
    forms.push({ command: e, consumes: true });
    if (kind === "deploy" && e === "pnpm live") forms.push({ command: `${e} -- --confirm=production`, consumes: true });
  }
  if (kind === "deploy" && entry.db_entry && entry.db_entry !== "-") {
    forms.push({ command: entry.db_entry, consumes: false }, { command: `${entry.db_entry} --confirm=production`, consumes: false });
  }
  return forms.map((f) => ({ ...f, command: (shellWords(f.command) ?? [f.command]).join(" ") }));
};

/**
 * 1 回分の許可の道(fixedStop の前の 1 か所、D123): 方針が manual で、そのスイッチの許可がある時だけ通し、使ったら消す。
 * 印(DEVCHECK_GRANT)は要らない(人の 1 回の言葉だから)。当たらなければ null
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
  const entries = deps.entries ? deps.entries() : {};
  // 許可のある危険な種類の danger(読むだけ、許可は使わない)は印が無くても通す(/allow の流れの途中で止まらないように)
  const dangerRead = /^pnpm (?:-s )?workflow devcheck danger ([a-z]+)$/.exec(command);
  if (dangerRead && permit.switches.includes(dangerRead[1])) return { decision: "allow", reason: `devcheck の 1 回の許可: ${dangerRead[1]} の danger(読むだけ)` };
  for (const kind of DANGER_NAMES) {
    const sw = switchOf(kind);
    if (policy[kind] !== "manual" || !sw || !permit.switches.includes(sw)) continue;
    const form = dangerForms(kind, entries[kind] ?? {}).find((f) => f.command === command);
    if (!form) continue;
    if (form.consumes) deps.consume?.(sw);
    return { decision: "allow", reason: `devcheck の 1 回の許可: ${sw}(${kind}=manual)` };
  }
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
  const stop = fixedStop(req);
  if (stop) return stop;
  if (!deps.grant) return null;
  /** @type {Match | null} */
  let match = null;
  if (req.tool === "Bash" && typeof req.command === "string") match = classifyBash(req.command, deps.itemKind);
  else if (req.tool.startsWith(BROWSER_PREFIX)) match = classifyBrowser(req, deps);
  if (!match) return null;
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
 * @param {{ projectDir: string; toolDir: string; env: NodeJS.ProcessEnv; policy: Record<string, string> | null; entries?: Record<string, Record<string, string>> | null }} o
 * @returns {Deps}
 */
export const realDeps = ({ projectDir, toolDir, env, policy, entries = null }) => ({
  grant: env[GRANT_ENV] === GRANT_ON,
  policy: () => {
    if (!policy) throw new Error("方針が読めない");
    return policy;
  },
  entries: () => entries ?? {},
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
  // 1 回分の許可がある間は Bash の判定に方針と入口が要る(許可の道は fixedStop の前)
  if (req.tool === "Bash" && deps.permit?.()) return true;
  if (!deps.grant || fixedStop(req)) return false;
  return req.tool === "Bash" || req.tool.startsWith(BROWSER_PREFIX);
};
