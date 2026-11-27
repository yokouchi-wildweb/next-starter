// scripts/workflow/agent-terminal/lib.mjs
//
// エージェントが動かす端末(AGENT_TERMINAL)の読み取りと、tmux のペインに打ち込む道具の共通処理。
// 使い手: hook.mjs(.claude/settings.json の hook)、compactPlan.mjs / compactSelf.mjs(pnpm workflow agent-terminal compactPlan / compactSelf)、
// lib.waiter.mjs(裏で待って打つ役)。圧縮の引き継ぎの一時ファイルもここ(端末に関係なく使う)。
// 文脈(ルール・CLAUDE.md・hook の出力)には端末のことを書かない。端末による分かれ道はこのフォルダの中だけに置く。
// 説明: scripts/workflow/agent-terminal/README.md

import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { appendFileSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const HERE = path.dirname(fileURLToPath(import.meta.url));

/** AGENT_TERMINAL が取る値(この会話が tmux を使うか)。無い・知らない値 = none(端末に頼る道具はすべて何もしない) */
export const TERMINALS = ["tmux", "none"];

/** プロジェクトの既定値のファイル(git に入る)。人ごとの上書きはプロセスの環境変数 AGENT_TERMINAL */
export const DEFAULT_FILE = path.join(HERE, "default.conf");

/** default.conf から値を読む(`AGENT_TERMINAL=<値>` の行。# から後は注釈) */
export function readDefaultFile(file = DEFAULT_FILE) {
  let text;
  try {
    text = readFileSync(file, "utf8");
  } catch {
    return undefined;
  }
  for (const raw of text.split("\n")) {
    const line = raw.replace(/#.*/, "").trim();
    const m = line.match(/^AGENT_TERMINAL\s*=\s*(\S+)$/);
    if (m) return m[1];
  }
  return undefined;
}

/** 読む順: プロセスの環境変数 → default.conf。無い・知らない値は none */
export function readAgentTerminal(env = process.env, file = DEFAULT_FILE) {
  const value = (env.AGENT_TERMINAL ?? "").trim() || readDefaultFile(file);
  return TERMINALS.includes(value) ? value : "none";
}

/** 圧縮の頼み先のコマンド(空白で区切った実行ファイルと引数)と、残すことを渡す環境変数 */
export const COMPACT_CMD_ENV = "AGENT_COMPACT_CMD";
export const COMPACT_FOCUS_ENV = "AGENT_COMPACT_FOCUS";
/** 頼み先に渡す、圧縮の後に打つ 1 行の種類(compactSelf の --then の値。頼み先はそれを印 after に書く: afterCompact) */
export const COMPACT_THEN_ENV = "AGENT_COMPACT_THEN";

/** 圧縮の後に打つ 1 行の種類(印 after の値。none = 何も打たない) */
export const AFTER_COMPACT = ["continue", "wait", "none"];

/** 頼み先に渡す、引き継ぎの一時ファイルの場所 */
export const COMPACT_HANDOFF_ENV = "AGENT_COMPACT_HANDOFF";
/** 会話を束ねる道具が渡す圧縮の文脈ファイル(版つき key=value。下の readCompactContext) */
export const COMPACT_CONTEXT_ENV = "AGENT_COMPACT_CONTEXT";

/**
 * 圧縮の頼み先(AGENT_COMPACT_CMD)。{ cmd, args, env: <渡す環境変数の追加> } か null
 * @returns {{ cmd: string, args: string[], env: Record<string, string> } | null}
 */
export function compactHandoff(env = process.env, focus = "", handoff = "") {
  const words = (env[COMPACT_CMD_ENV] ?? "").trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return null;
  const add = { [COMPACT_FOCUS_ENV]: focus };
  if (handoff) add[COMPACT_HANDOFF_ENV] = handoff;
  return { cmd: words[0], args: words.slice(1), env: add };
}

/**
 * 圧縮の文脈(AGENT_COMPACT_CONTEXT のファイル)。中身 = `v=1` と `prepare=<足す手順>`(繰り返してよい)・`then=<continue|wait|none>`
 * (既定の続き)。# から後は注釈。値が無い = 単体({ prepare: [], then: null })。
 * 読めない・相対パス・版が違う・知らない鍵や値 = { error } (compactPlan が 1 行で知らせ、足す手順なしで進む)
 * @returns {{ prepare: string[], then: string | null, error?: string }}
 */
export function readCompactContext(env = process.env) {
  const file = (env[COMPACT_CONTEXT_ENV] ?? "").trim();
  const none = { prepare: [], then: null };
  if (file === "") return none;
  if (!path.isAbsolute(file)) return { ...none, error: `${COMPACT_CONTEXT_ENV} は絶対パス(${file})` };
  let text;
  try {
    text = readFileSync(file, "utf8");
  } catch {
    return { ...none, error: `${COMPACT_CONTEXT_ENV} を読めない(${file})` };
  }
  const lines = text.split("\n").map((l) => l.replace(/#.*/, "").trim()).filter(Boolean);
  if (!lines.includes("v=1")) return { ...none, error: `${COMPACT_CONTEXT_ENV} の版が v=1 でない(${file})` };
  const out = { prepare: [], then: null };
  for (const l of lines) {
    if (l === "v=1") continue;
    const m = l.match(/^(prepare|then)=(.*)$/);
    if (!m) return { ...none, error: `${COMPACT_CONTEXT_ENV} に知らない行(${l})` };
    if (m[1] === "prepare") {
      if (m[2].trim()) out.prepare.push(m[2].trim());
    } else if (AFTER_COMPACT.includes(m[2].trim())) out.then = m[2].trim();
    else return { ...none, error: `${COMPACT_CONTEXT_ENV} の then が違う(${m[2]})` };
  }
  return out;
}

// ---- 引き継ぎの一時ファイル(圧縮の前に書き、圧縮の後の SessionStart で読み戻して消す。会話ごとに 1 つ)

/** 読み戻す新しさの上限(書いてから圧縮まで)。これより古い = 打たれずに残った物なので読まない */
export const HANDOFF_FRESH_MS = 6 * 3600 * 1000;
/** 掃除: これより古い一時ファイルは SessionStart で消す */
export const HANDOFF_KEEP_MS = 14 * 24 * 3600 * 1000;

/** 今の会話の id(Claude Code が Bash に渡す CLAUDE_CODE_SESSION_ID)。形が違えば "" */
export const sessionOf = (env = process.env) => {
  const id = (env.CLAUDE_CODE_SESSION_ID ?? "").trim();
  return /^[A-Za-z0-9_-]+$/.test(id) ? id : "";
};

export const handoffDir = (env = process.env) => path.join(stateRoot(env), "handoff");

/** その会話の一時ファイル。会話の id の形が違えば "" */
export const handoffFile = (session, env = process.env) =>
  /^[A-Za-z0-9_-]+$/.test(session ?? "") ? path.join(handoffDir(env), `${session}.md`) : "";

/** 一時ファイルの頭の 1 行(compactSelf が書く。圧縮の後の続きと書いた時刻) */
const HEAD = /^<!-- agent-terminal handoff: then=(continue|wait|none) at=(\d+) -->\n/;

/** compactSelf が圧縮を頼むときに、一時ファイルの頭に続きの種類と時刻を書く(無ければ何もしない)。書いたら true */
export function stampHandoff(file, then, now = Date.now()) {
  let body;
  try {
    body = readFileSync(file, "utf8");
  } catch {
    return false;
  }
  writeFileSync(file, `<!-- agent-terminal handoff: then=${then} at=${now} -->\n${body.replace(HEAD, "")}`);
  return true;
}

/**
 * 圧縮の後に読み戻す中身。読んだら消す(一度きり)。無い・空・古い = null(古い物も消す)
 * @returns {{ then: string, body: string } | null}
 */
export function takeHandoff(file, now = Date.now()) {
  if (!file) return null;
  let text;
  let mtime;
  try {
    text = readFileSync(file, "utf8");
    mtime = statSync(file).mtimeMs;
  } catch {
    return null;
  }
  rmSync(file, { force: true });
  const m = text.match(HEAD);
  const at = m ? Number(m[2]) : mtime;
  const body = text.replace(HEAD, "").trim();
  if (!body || now - at > HANDOFF_FRESH_MS) return null;
  return { then: m ? m[1] : "continue", body };
}

/** 古い一時ファイルの掃除(SessionStart のたび) */
export function sweepHandoffs(env = process.env, now = Date.now()) {
  const dir = handoffDir(env);
  let names;
  try {
    names = readdirSync(dir);
  } catch {
    return;
  }
  for (const name of names) {
    const file = path.join(dir, name);
    try {
      if (now - statSync(file).mtimeMs > HANDOFF_KEEP_MS) rmSync(file, { force: true });
    } catch {
      // 消せないだけ
    }
  }
}

/** 端末ごとの案内(SessionStart で文脈に入れる)。値ごとに 1 ファイル、none には無い */
export const guideFile = (terminal) => path.join(HERE, `AGENT_TERMINAL.${terminal}.md`);

/** 今のペイン(tmux の中で、AGENT_TERMINAL=tmux のときだけ)。{ socket, pane, key } か null */
export function currentPane(env = process.env) {
  if (readAgentTerminal(env) !== "tmux") return null;
  return paneOf((env.TMUX ?? "").split(",")[0], env.TMUX_PANE ?? "");
}

/** あるペイン(socket のパスとペイン id %N)の { socket, pane, key }。形が違えば null(別のペインの印を書く道具が使う) */
export function paneOf(socket, pane) {
  if (!socket || !/^%\d+$/.test(pane ?? "")) return null;
  const key = `${createHash("md5").update(socket).digest("hex").slice(0, 10)}_${pane.slice(1)}`;
  return { socket, pane, key };
}

/** 記録の置き場(ペインごと)。AGENT_TERMINAL_STATE_DIR(テスト用)→ XDG_STATE_HOME → ~/.local/state */
export function stateRoot(env = process.env) {
  if (env.AGENT_TERMINAL_STATE_DIR) return env.AGENT_TERMINAL_STATE_DIR;
  const base = env.XDG_STATE_HOME || path.join(env.HOME || os.homedir(), ".local", "state");
  return path.join(base, "next-starter", "agent-terminal");
}

export const paneDir = (pane, env = process.env) => path.join(stateRoot(env), "panes", pane.key);

export function readMark(dir, name) {
  try {
    return readFileSync(path.join(dir, name), "utf8").trim();
  } catch {
    return "";
  }
}

export function writeMark(dir, name, value) {
  mkdirSync(dir, { recursive: true });
  writeFileSync(path.join(dir, name), `${value}\n`);
}

/** 打ち込みの結果を 1 行ずつ残す(<時刻> <purpose> <結果>)。人とエージェントが後から見る */
export function log(dir, purpose, outcome) {
  try {
    mkdirSync(dir, { recursive: true });
    appendFileSync(path.join(dir, "typein.log"), `${new Date().toISOString()}\t${purpose}\t${outcome}\n`);
  } catch {
    // 記録できないだけ
  }
}

/** tmux のコマンド(そのペインの socket に向けて) */
export function tmux(pane, args) {
  return spawnSync("tmux", ["-S", pane.socket, ...args], { encoding: "utf8", timeout: 5000 });
}

/**
 * 画面(capture-pane -e -p の出力)から入力欄の中身を取り出す。
 * 入力欄 = 最後の `❯` の行で、すぐ上が罫線(────。/rename した会話は `──── 名前 ─` で、そのときは下の罫線もあること)。
 * その下の次の罫線までが下書き。Claude Code が薄く(ESC[2m)描く案内は除く。
 * 戻り値: 入力欄の文字(空 = 空の入力欄)/ null = 入力欄が無い(確認の画面など。選択肢は `❯ 1. Yes` で上に罫線が無い)
 */
export function boxText(screen) {
  const plain = (l) =>
    l
      .replace(/\x1b\[2m.*?(?=\x1b\[(?:0|22)?m|$)/g, "")
      .replace(/\x1b\[[0-9;?]*[A-Za-z]/g, "")
      .replace(/ /g, " ");
  const rule = (l) => /^\s*─+\s*$/.test(plain(l));
  const named = (l) => /^\s*─{3,} \S(.*\S)? ─+\s*$/.test(plain(l));
  const lines = screen.split("\n");
  let i = -1;
  lines.forEach((l, n) => {
    if (l.includes("❯")) i = n;
  });
  if (i <= 0) return null;
  const top = lines[i - 1];
  if (!rule(top) && !named(top)) return null;
  const out = [plain(lines[i].split("❯").slice(1).join("❯"))];
  let closed = false;
  for (const l of lines.slice(i + 1)) {
    if (rule(l)) {
      closed = true;
      break;
    }
    out.push(plain(l));
  }
  if (named(top) && !closed) return null;
  return out
    .map((x) => x.trim())
    .join("\n")
    .trim();
}

/** 打ち込む文を 1 行にする(改行は空白に) */
export const oneLine = (text) => text.replace(/\s*\n\s*/g, " ").trim();

/** 待つ役が見る印をそろえて読む */
export const marks = (dir) => ({
  session: readMark(dir, "session"),
  busy: readMark(dir, "busy"),
  idle: readMark(dir, "idle"),
});

