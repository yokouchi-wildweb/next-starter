// scripts/workflow/agent-terminal/lib.mjs
//
// エージェントが動かす端末(AGENT_TERMINAL)の読み取りと、tmux のペインに打ち込む道具の共通処理。
// 使い手: hook.mjs(.claude/settings.json の hook)、compactSelf.mjs(pnpm workflow agent-terminal compactSelf)、lib.waiter.mjs(裏で待って打つ役)。
// 文脈(ルール・CLAUDE.md・hook の出力)には端末のことを書かない。端末による分かれ道はこのフォルダの中だけに置く。
// 説明: scripts/workflow/agent-terminal/README.md

import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const HERE = path.dirname(fileURLToPath(import.meta.url));

/** AGENT_TERMINAL が取る値。無い・知らない値 = none(端末に頼る道具はすべて何もしない) */
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

/**
 * 圧縮の頼み先(AGENT_COMPACT_CMD)。{ cmd, args, env: <渡す環境変数の追加> } か null
 * @returns {{ cmd: string, args: string[], env: Record<string, string> } | null}
 */
export function compactHandoff(env = process.env, focus = "") {
  const words = (env[COMPACT_CMD_ENV] ?? "").trim().split(/\s+/).filter(Boolean);
  if (words.length > 0) return { cmd: words[0], args: words.slice(1), env: { [COMPACT_FOCUS_ENV]: focus } };
  return legacyHandoff(env, focus).compact;
}

/**
 * 古い形の値(切り替えで消す)。値を書く側がまだ一般の値(AGENT_TERMINAL=none・AGENT_COMPACT_CMD)を書かない間だけ、
 * その古い環境変数を読む。古い名前はこの関数の中だけに置く。
 * driven = 端末は別の道具が持つ / compact = 古い形の頼み先(そろう時だけ)
 * @returns {{ driven: boolean, compact: { cmd: string, args: string[], env: Record<string, string> } | null }}
 */
export function legacyHandoff(env = process.env, focus = "") {
  const driven = ["TK_TEAM", "LOUNGE_ROLE", "GUILD_ROLE", "FLEET_ROLE", "COUNCIL_ROLE"].some((k) => (env[k] ?? "") !== "");
  const [tool, instance, tab] = ["TK_TEAM", "TK_INSTANCE", "TK_TAB"].map((k) => (env[k] ?? "").trim());
  const compact = tool && instance && tab ? { cmd: tool, args: ["compact", instance, tab], env: { TK_COMPACT_FOCUS: focus } } : null;
  return { driven, compact };
}

/**
 * 端末は別の道具が持つ(AGENT_TERMINAL=none、または古い形の値)。圧縮も打ち込みもそちらが受け持つので、ここでは何もしない
 */
export function isDrivenByAnotherTool(env = process.env) {
  return readAgentTerminal(env) === "none" || legacyHandoff(env).driven;
}

/** 端末ごとの案内(SessionStart で文脈に入れる)。値ごとに 1 ファイル、none には無い */
export const guideFile = (terminal) => path.join(HERE, `AGENT_TERMINAL.${terminal}.md`);

/** 今のペイン(tmux の中で、AGENT_TERMINAL=tmux のときだけ)。{ socket, pane, key } か null */
export function currentPane(env = process.env) {
  if (readAgentTerminal(env) !== "tmux" || isDrivenByAnotherTool(env)) return null;
  const socket = (env.TMUX ?? "").split(",")[0];
  const pane = env.TMUX_PANE ?? "";
  if (!socket || !/^%\d+$/.test(pane)) return null;
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

export { existsSync };
