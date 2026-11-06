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

/** Claude Code の文書(terminal-config)が tmux に勧める設定 + マウスでのスクロール */
export const TMUX_CONF_LINES = [
  "set -g allow-passthrough on",
  "set -g focus-events on",
  "set -s extended-keys on",
  "set -as terminal-features 'xterm*:extkeys'",
  "set -g mouse on",
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

export const rcBody = (installed) => `[ -f "${installed}" ] && . "${installed}"`;

const read = (file) => (existsSync(file) ? readFileSync(file, "utf8") : null);

export const hasTmux = () => spawnSync("tmux", ["-V"], { stdio: "ignore" }).status === 0;

/** このマシンの入り具合 */
export const inspect = (env = process.env) => {
  const p = paths(env);
  const sourceVersion = parseVersion(read(SOURCE));
  const installedVersion = parseVersion(read(p.installed));
  const rcOk = hasBlock(read(p.rc));
  const tmuxConfOk = hasBlock(read(p.tmuxConf));
  const tmux = hasTmux();
  const upToDate = installedVersion !== null && installedVersion >= (sourceVersion ?? 0);
  return { ...p, tmux, sourceVersion, installedVersion, rcOk, tmuxConfOk, upToDate, ok: tmux && rcOk && tmuxConfOk && upToDate };
};
