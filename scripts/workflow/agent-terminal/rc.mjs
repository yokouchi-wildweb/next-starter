// scripts/workflow/agent-terminal/rc.mjs — pnpm workflow agent-terminal rc <宛先> [--socket=<名前>] [--wait=<秒>]
//
// /reinforce の rc: Remote Control が切れたタブに、別のタブから `/remote-control` を打ち込む。
// 宛先(ペインを 1 つに決める):
//   %<N>                 そのペイン(--socket=<名前> で tmux -L <名前>、省けばこのユーザーの全サーバーから)
//   <セッション>[:<窓>]   tmux のセッション(と窓の番号か名前)の見えているペイン
//   ほか                 会話の名前(claude agents の名前、peer と同じ)→ その会話の SessionStart の印(lib.mjs paneDir の session)を持つペイン
// 1 つに決まらない(無い・2 つ以上)・相手が tmux の外 → 打たず、候補か「そのタブで /remote-control と打つ」の 1 行。
// 打つのは入力欄が空で作業中の表示(esc to interrupt)が無い時だけ(lib.waiter.mjs と同じ確かめ)。待つのは --wait 秒(既定 120)まで。
// 打った後、数秒の間に画面に `rc active` が出たかを 1 行で出す(Claude Code の表示の文字。狭い画面では出ないことがある)。
// 結果は打ったペインの typein.log にも 1 行(印の置き場が分かるペインだけ)。
// 終了コード: 0 = 打った / 1 = 使い方の誤り / 3 = 打たなかった。説明: scripts/workflow/agent-terminal/README.md

import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { log, paneDir, paneOf, readMark } from "./lib.mjs";
import { allPanes, paneLabel, screenState, sockets } from "./lib.reinforce.mjs";
import { readAgents, resolveName } from "../peer/lib.agents.mjs";

const USAGE = "使い方: pnpm workflow agent-terminal rc <宛先: 会話の名前 | <セッション>[:<窓>] | %<N>> [--socket=<名前>] [--wait=<秒>]";
const HERE_LINE = "そのタブで /remote-control と打ってください";

const sleepMs = (ms) => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
const plain = (s) => s.replace(/\x1b\[[0-9;?]*[A-Za-z]/g, "");

/** 宛先 → { panes: [...] , why } */
export function findPanes(target, { socket, panes = null, agents = null } = {}) {
  const list = panes ?? allPanes(socket ? [socketPathOf(socket)] : sockets());
  if (/^%\d+$/.test(target)) return { panes: list.filter((p) => p.pane === target) };
  const m = target.match(/^([^:]+)(?::(.+))?$/);
  const bySession = list.filter((p) => p.session === m[1]);
  if (bySession.length) {
    const win = m[2];
    const inWin = win === undefined ? bySession.filter((p) => p.windowActive) : bySession.filter((p) => p.window === win || p.windowName === win);
    const active = inWin.filter((p) => p.paneActive);
    return { panes: active.length ? active : inWin };
  }
  // 会話の名前: claude agents の名前 → session id → その id を印に持つペイン
  const rows = agents ?? readAgents();
  if (!rows) return { panes: [], why: "claude agents --json が読めません" };
  const r = resolveName(rows, target, process.env.CLAUDE_CODE_SESSION_ID ?? "");
  if (r.kind !== "one") return { panes: [], candidates: r.candidates.slice(0, 8).map((c) => `${c.name}(${c.repo}、${c.status})`), why: r.kind === "many" ? "同じ名前の会話が 2 つ以上" : "その名前の会話がありません" };
  const hits = list.filter((p) => {
    const pk = paneOf(p.socket, p.pane);
    return pk && readMark(paneDir(pk), "session") === r.target.sessionId;
  });
  return { panes: hits, why: hits.length ? "" : `会話 ${target} は tmux の中で見つかりません(tmux の外か、AGENT_TERMINAL=tmux でない)` };
}

const socketPathOf = (name) => {
  const r = spawnSync("tmux", ["-L", name, "display-message", "-p", "#{socket_path}"], { encoding: "utf8" });
  return (r.stdout ?? "").trim() || name;
};

export function runRc(args, env = process.env, print = console.log) {
  const flags = {};
  const rest = [];
  for (const a of args) {
    const m = a.match(/^--(socket|wait)=(.*)$/);
    if (m) flags[m[1]] = m[2];
    else if (a.startsWith("--")) {
      print(USAGE);
      return 1;
    } else rest.push(a);
  }
  const waitSec = flags.wait === undefined ? 120 : Number(flags.wait);
  if (rest.length !== 1 || !Number.isFinite(waitSec) || waitSec < 0) {
    print(USAGE);
    return 1;
  }
  const target = rest[0];
  const found = findPanes(target, { socket: flags.socket });
  if (found.panes.length !== 1) {
    if (found.panes.length > 1) {
      print(`rc: 宛先 ${target} のペインが ${found.panes.length} つあります。打っていません。宛先を %<N> か <セッション>:<窓>(別のサーバーなら --socket=<名前>)で 1 つに:`);
      for (const p of found.panes) print(`  ${paneLabel(p)}`);
    } else {
      print(`rc: ${found.why || `宛先 ${target} のペインが見つかりません`}。打っていません。${HERE_LINE}`);
      for (const c of found.candidates ?? []) print(`  候補: ${c}`);
    }
    return 3;
  }
  const p = found.panes[0];
  const at = ["-S", p.socket];
  const tm = (a) => spawnSync("tmux", [...at, ...a], { encoding: "utf8", timeout: 5000 });
  const pk = paneOf(p.socket, p.pane);
  const note = (outcome) => pk && log(paneDir(pk), "rc", `${outcome}: /remote-control`);
  const until = Date.now() + waitSec * 1000;
  let state;
  for (;;) {
    state = screenState(tm(["capture-pane", "-e", "-p", "-t", p.pane]).stdout ?? "");
    if (state.free) break;
    if (Date.now() >= until) {
      note(`skip: ${state.why}`);
      print(`rc: ${paneLabel(p)} は ${waitSec} 秒待っても打てる形になりませんでした(${state.why})。打っていません。${HERE_LINE}`);
      return 3;
    }
    sleepMs(1000);
  }
  if (tm(["send-keys", "-t", p.pane, "-l", "--", "/remote-control"]).status !== 0) {
    note("skip: send failed");
    print(`rc: ${paneLabel(p)} に打てませんでした(tmux)。${HERE_LINE}`);
    return 3;
  }
  sleepMs(300);
  tm(["send-keys", "-t", p.pane, "Enter"]);
  note("typed");
  let active = false;
  for (let i = 0; i < 8 && !active; i++) {
    sleepMs(1000);
    active = /rc active/i.test(plain(tm(["capture-pane", "-p", "-t", p.pane]).stdout ?? ""));
  }
  print(
    active
      ? `rc: ${paneLabel(p)} に /remote-control を打ち、画面に「rc active」が出ました`
      : `rc: ${paneLabel(p)} に /remote-control を打ちました。画面に「rc active」はまだ出ていません(狭い画面では出ないことがあります。そのタブか claude.ai/code で確かめてください)`,
  );
  return 0;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exitCode = runRc(process.argv.slice(2));
}
