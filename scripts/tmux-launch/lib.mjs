// scripts/tmux-launch/lib.mjs
//
// pnpm setup:tmux-launch と SessionStart hook(check.mjs)の共通処理。
// マシンに入れるもの: 中身(claude-tmux.sh の写し)・シェルの設定の 1 行・~/.tmux.conf の塊。どれも印で囲み、何度入れても重ならない。
// 説明: scripts/tmux-launch/README.md

import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const SOURCE = path.join(path.dirname(fileURLToPath(import.meta.url)), "claude-tmux.sh");
export const BLOCK_START = "# >>> next-starter claude-tmux >>>";
export const BLOCK_END = "# <<< next-starter claude-tmux <<<";

/**
 * Claude Code の文書(terminal-config)が tmux に勧める設定 + マウスでのスクロール。
 * どれも -q を付ける: その版の tmux が知らない設定(allow-passthrough は 3.3 から、extended-keys は 3.2 から)を
 * エラーにせず黙って飛ばす。-q が無いと、tmux サーバーの起動時(最初の 1 回)に設定のエラーが最初のタブに重なって出る
 */
export const TMUX_CONF_LINES = [
  "set -gq allow-passthrough on",
  "set -gq focus-events on",
  "set -sq extended-keys on",
  "set -asq terminal-features 'xterm*:extkeys'",
  "set -gq mouse on",
];

/** 置き場所(HOME・XDG_DATA_HOME・SHELL から決まる) */
export const paths = (env = process.env) => {
  const home = env.HOME || os.homedir();
  const dataHome = env.XDG_DATA_HOME || path.join(home, ".local/share");
  const shell = path.basename(env.SHELL || "bash");
  return {
    home,
    installed: path.join(dataHome, "next-starter/claude-tmux.sh"),
    rc: path.join(home, shell === "zsh" ? ".zshrc" : ".bashrc"),
    tmuxConf: path.join(home, ".tmux.conf"),
  };
};

/** ファイルの中の版(NEXT_STARTER_CLAUDE_TMUX_VERSION=<n>)。無ければ null */
export const parseVersion = (text) => {
  const match = /^NEXT_STARTER_CLAUDE_TMUX_VERSION=(\d+)/m.exec(text ?? "");
  return match ? Number(match[1]) : null;
};

/** 印で囲んだ塊を body に差し替える(無ければ末尾に足す) */
export const upsertBlock = (text, body) => {
  const block = `${BLOCK_START}\n${body.trimEnd()}\n${BLOCK_END}\n`;
  const current = text ?? "";
  const start = current.indexOf(BLOCK_START);
  const end = current.indexOf(BLOCK_END);
  if (start !== -1 && end > start) {
    return current.slice(0, start) + block + current.slice(end + BLOCK_END.length).replace(/^\n/, "");
  }
  const sep = current === "" || current.endsWith("\n") ? "" : "\n";
  return `${current}${sep}${current === "" ? "" : "\n"}${block}`;
};

/** 印で囲んだ塊を外す(前の空行 1 つも) */
export const removeBlock = (text) => {
  const current = text ?? "";
  const start = current.indexOf(BLOCK_START);
  const end = current.indexOf(BLOCK_END);
  if (start === -1 || end < start) return current;
  const before = current.slice(0, start).replace(/\n\n$/, "\n");
  return before + current.slice(end + BLOCK_END.length).replace(/^\n/, "");
};

export const hasBlock = (text) => (text ?? "").includes(BLOCK_START) && (text ?? "").includes(BLOCK_END);

/** 印の塊の中身(無ければ null) */
export const blockBody = (text) => {
  const current = text ?? "";
  const start = current.indexOf(BLOCK_START);
  const end = current.indexOf(BLOCK_END);
  if (start === -1 || end < start) return null;
  return current.slice(start + BLOCK_START.length, end).trim();
};

/** 印の塊が今の中身どおりか(古い中身のままなら false) */
export const blockMatches = (text, body) => blockBody(text) === body.trim();

export const tmuxConfBody = () => TMUX_CONF_LINES.join("\n");

export const rcBody = (installed) => `[ -f "${installed}" ] && . "${installed}"`;

const read = (file) => (existsSync(file) ? readFileSync(file, "utf8") : null);

export const hasTmux = () => spawnSync("tmux", ["-V"], { stdio: "ignore" }).status === 0;

/** このマシンの入り具合 */
export const inspect = (env = process.env) => {
  const p = paths(env);
  const sourceVersion = parseVersion(read(SOURCE));
  const installedVersion = parseVersion(read(p.installed));
  const rcText = read(p.rc);
  const confText = read(p.tmuxConf);
  const rcOk = blockMatches(rcText, rcBody(p.installed));
  const tmuxConfOk = blockMatches(confText, tmuxConfBody());
  // 入ってはいるが中身が古い(どれかが古ければ「古い」と案内する)
  const stale = (installedVersion !== null && installedVersion < (sourceVersion ?? 0)) ||
    (hasBlock(rcText) && !rcOk) || (hasBlock(confText) && !tmuxConfOk);
  const tmux = hasTmux();
  const upToDate = installedVersion !== null && installedVersion >= (sourceVersion ?? 0);
  return { ...p, tmux, sourceVersion, installedVersion, rcOk, tmuxConfOk, upToDate, stale, ok: tmux && rcOk && tmuxConfOk && upToDate };
};
