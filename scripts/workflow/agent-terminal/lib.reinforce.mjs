// scripts/workflow/agent-terminal/lib.reinforce.mjs
//
// /reinforce の 2 つの動作(open.mjs・rc.mjs)が使う tmux の共通処理: tmux が入っているか、どのサーバー(socket)に向けるか、
// このユーザーの tmux のサーバーとペインの一覧。打ち込みの確かめ(入力欄が空・作業中でない)は lib.mjs boxText と同じ形。
// 説明: scripts/workflow/agent-terminal/README.md

import { spawnSync } from "node:child_process";
import { readdirSync, statSync } from "node:fs";
import os from "node:os";
import path from "node:path";

import { boxText } from "./lib.mjs";

/** tmux が入っているか */
export const hasTmux = () => spawnSync("tmux", ["-V"], { encoding: "utf8" }).status === 0;

/** サーバーの指定: { args, label }。--socket=<名前> = -L <名前> / 呼んだ会話が tmux の中 = 同じ socket(-S) / ほか = 既定のサーバー */
export function serverOf(socketName, env = process.env) {
  if (socketName) return { args: ["-L", socketName], label: `tmux -L ${socketName}` };
  const inside = (env.TMUX ?? "").split(",")[0];
  if (inside) return { args: ["-S", inside], label: `tmux -S ${inside}` };
  return { args: [], label: "tmux" };
}

export const tmuxAt = (server, args) => spawnSync("tmux", [...server.args, ...args], { encoding: "utf8", timeout: 5000 });

/** このユーザーの tmux のサーバー(socket のパス)。TMUX_TMPDIR(既定 /tmp)/tmux-<uid>/ の中 */
export function sockets(env = process.env) {
  const dir = path.join(env.TMUX_TMPDIR || "/tmp", `tmux-${os.userInfo().uid}`);
  let names = [];
  try {
    names = readdirSync(dir);
  } catch {
    return [];
  }
  return names.map((n) => path.join(dir, n)).filter((p) => {
    try {
      return statSync(p).isSocket();
    } catch {
      return false;
    }
  });
}

const PANE_FORMAT = "#{pane_id}\t#{session_name}\t#{window_index}\t#{window_name}\t#{window_active}\t#{pane_active}";

/** 生きているサーバーの全ペイン: [{ socket, pane, session, window, windowName, windowActive, paneActive }] */
export function allPanes(socketList = sockets()) {
  const out = [];
  for (const socket of socketList) {
    const r = spawnSync("tmux", ["-S", socket, "list-panes", "-a", "-F", PANE_FORMAT], { encoding: "utf8", timeout: 5000 });
    if (r.status !== 0) continue;
    for (const line of r.stdout.split("\n").filter(Boolean)) {
      const [pane, session, window, windowName, wa, pa] = line.split("\t");
      out.push({ socket, pane, session, window, windowName, windowActive: wa === "1", paneActive: pa === "1" });
    }
  }
  return out;
}

/** ペインを人に見せる 1 行の形 */
export const paneLabel = (p) => `${p.session}:${p.window}(${p.windowName}) ${p.pane} — tmux -S ${p.socket}`;

/** 画面が打ってよい形か: 入力欄が空で、作業中の表示(esc to interrupt)が無い。lib.waiter.mjs と同じ確かめ */
export function screenState(screen) {
  const box = boxText(screen);
  const working = /esc to interrupt/i.test(screen.replace(/\x1b\[[0-9;?]*[A-Za-z]/g, ""));
  if (box === null) return { free: false, why: "no input box on the screen" };
  if (working) return { free: false, why: "the session is working" };
  if (box !== "") return { free: false, why: "the input box is not empty" };
  return { free: true, why: "" };
}
