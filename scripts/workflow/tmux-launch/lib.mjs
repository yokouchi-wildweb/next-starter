// scripts/workflow/tmux-launch/lib.mjs
//
// pnpm workflow tmux-launch setup と SessionStart hook(check.mjs)の共通処理。
// マシンに入れるもの: 中身(claude-tmux.sh の写し)・シェルの設定の 1 行・~/.tmux.conf の塊。どれも印で囲み、何度入れても重ならない。
// 説明: scripts/workflow/tmux-launch/README.md

import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const SOURCE = path.join(path.dirname(fileURLToPath(import.meta.url)), "claude-tmux.sh");
export const BLOCK_START = "# >>> next-starter claude-tmux >>>";
export const BLOCK_END = "# <<< next-starter claude-tmux <<<";

/** 通常セッションの色(Claude のテーマ色。チームツールの各チームの色と重ならない。guild=172 / hq=214 / fleet=39 / council=135 / quest=117 / lounge=109) */
export const SESSION_COLOUR = "#d97757";

// 状態の行の 1 つのタブ / 今のタブ(#{W:a,b} の中ではカンマが枝の区切りなので、#[...] には属性を 1 つずつ書く)
const TAB = " #[range=window|#{window_index}]#[fg=colour250]#{window_index} #{window_name}#[norange] #[fg=colour240]│";
const CUR = ` #[range=window|#{window_index}]#[bg=${SESSION_COLOUR}]#[fg=black]#[bold]▌#{window_index} #{window_name}▐#[norange]#[bg=colour236]#[nobold] #[fg=colour240]│`;
const HINT = "F1-F12 タブ移動 ・ Shift+←→ 前後 ・ タブはクリックでも移動 ・ ターミナルを閉じると終わる";

/**
 * ~/.tmux.conf の塊に書く設定。
 * - Claude Code の文書(terminal-config)が tmux に勧める設定(通知・Shift+Enter)
 * - タブの移動と見た目はチームツール(~/.team/_bin/lib/teamkit.sh の tk_apply_keys / tk_apply_style)と同じにする:
 *   F1-F12 でそのタブへ、Shift+←→ で前後、タブは 1 から、下に 2 行(セッション名とタブの並び / 操作の案内)、
 *   各タブの上の枠に名札(「▶ <番号>  <名前>」)、マウス、履歴 50000 行、truecolor
 *   (チームのセッションはセッションごと・タブごとに自分の色で上書きするので、ここは既定として効く)
 * どれも -q を付ける: その版の tmux が知らない設定(allow-passthrough は 3.3 から、extended-keys は 3.2 から)を
 * エラーにせず黙って飛ばす。-q が無いと、tmux サーバーの起動時(最初の 1 回)に設定のエラーが最初のタブに重なって出る
 */
export const TMUX_CONF_LINES = [
  "set -gq allow-passthrough on",
  "set -gq focus-events on",
  "set -sq extended-keys on",
  "set -asq terminal-features 'xterm*:extkeys'",
  "set -gq mouse on",
  "set -gq history-limit 50000",
  'set -gq default-terminal "tmux-256color"',
  "set -agq terminal-overrides ',xterm-256color:RGB'",
  "set -gq base-index 1",
  "set -gq renumber-windows on",
  ...Array.from({ length: 12 }, (_, i) => `bind-key -n F${i + 1} select-window -t :${i + 1}`),
  "bind-key -n S-Left previous-window",
  "bind-key -n S-Right next-window",
  "set -gq status 2",
  'set -gq status-style "bg=colour236,fg=white"',
  `set -gq status-format[0] "#[align=left]#[bg=${SESSION_COLOUR},fg=black,bold] #{session_name} #[bg=colour236,fg=colour240,nobold] │#{W:${TAB},${CUR}}"`,
  `set -gq status-format[1] "#[align=left]#[fg=colour245] ${HINT}"`,
  "set -gwq pane-border-status top",
  'set -gwq pane-border-style "fg=colour240"',
  `set -gwq pane-active-border-style "fg=${SESSION_COLOUR}"`,
  `set -gwq pane-border-format "#[fg=${SESSION_COLOUR},bold] ▶ #{window_index}  #{?@desc,#{@desc},#{window_name}} #[default]"`,
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
