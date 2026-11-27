// scripts/workflow/agent-terminal/type.mjs — pnpm workflow agent-terminal type <宛先> [--socket=<名前>] [--wait=<秒>] [--no-enter] -- <打つ文字>
//
// /intervene の打ち込み: 別のタブ(tmux のペイン)の入力欄に 1 行打つ。方針はリポの repo.json の agent.intervene(D411、
// scripts/workflow/devcheck/lib.kinds.mjs): off = 打たず人の 1 行(exit 4)/ manual(既定)= 人の /allow itv(か言葉の許可)の
// 1 回分の許可(.agent/devcheck-allow.json、scripts/workflow/devcheck/lib.allow.mjs)がある時だけ。許可は宛先が 1 つに決まった時に
// 使って消える(決まらない時は使わない)。次の人の入力でも消える(devcheck の hook)。
// 宛先(ペインを 1 つに決める):
//   %<N>                 そのペイン(--socket=<名前> で tmux -L <名前>、省けばこのユーザーの全サーバーから)
//   <セッション>[:<窓>]   tmux のセッション(と窓の番号か名前)の見えているペイン
//   ほか                 会話の名前(claude agents の名前、peer と同じ)→ その会話の SessionStart の印(lib.mjs paneDir の session)を持つペイン
// 1 つに決まらない(無い・2 つ以上)・相手が tmux の外 → 打たず、候補か「そのタブで打つ」の 1 行。
// 打つのは入力欄が空で作業中の表示(esc to interrupt)が無い時だけ(lib.waiter.mjs と同じ確かめ)。待つのは --wait 秒(既定 120)まで。
// 打つ文字が /remote-control なら、打った後に画面の `rc active`(Claude Code の表示、狭い画面では出ないことがある)を数秒見て 1 行で言う。
// 結果は打ったペインの typein.log に 1 行。
// 終了コード: 0 = 打った / 1 = 使い方の誤り / 2 = 方針が読めない / 3 = 打たなかった(宛先・画面) / 4 = 方針 off・許可が無い。説明: scripts/workflow/agent-terminal/README.md

import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { log, oneLine, paneDir, paneOf, readMark } from "./lib.mjs";
import { consumePermit, readPermit } from "../devcheck/lib.allow.mjs";
import { offLine, readAgentPolicy, switchOf } from "../devcheck/lib.kinds.mjs";
import { allPanes, paneLabel, screenState, sockets } from "./lib.reinforce.mjs";
import { readAgents, resolveName } from "../peer/lib.agents.mjs";

const USAGE = "使い方: pnpm workflow agent-terminal type <宛先: 会話の名前 | <セッション>[:<窓>] | %<N>> [--socket=<名前>] [--wait=<秒>] [--no-enter] -- <打つ文字>";

const sleepMs = (ms) => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
const plain = (s) => s.replace(/\x1b\[[0-9;?]*[A-Za-z]/g, "");

const socketPathOf = (name) => {
  const r = spawnSync("tmux", ["-L", name, "display-message", "-p", "#{socket_path}"], { encoding: "utf8" });
  return (r.stdout ?? "").trim() || name;
};

/** 宛先 → { panes, why, candidates } */
export function findPanes(target, { socket, panes = null, agents = null, selfId = "" } = {}) {
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
  const r = resolveName(rows, target, selfId);
  if (r.kind !== "one") return { panes: [], candidates: r.candidates.slice(0, 8).map((c) => `${c.name}(${c.repo}、${c.status})`), why: r.kind === "many" ? "同じ名前の会話が 2 つ以上" : "その名前の会話がありません" };
  const hits = list.filter((p) => {
    const pk = paneOf(p.socket, p.pane);
    return pk && readMark(paneDir(pk), "session") === r.target.sessionId;
  });
  return { panes: hits, why: hits.length ? "" : `会話 ${target} は tmux の中で見つかりません(tmux の外か、AGENT_TERMINAL=tmux でない)` };
}

const KIND = "intervene";

/** 呼んだ所のチェックアウトの直下(git の外なら今の場所) */
const checkoutRoot = (cwd) => {
  const r = spawnSync("git", ["-C", cwd, "rev-parse", "--show-toplevel"], { encoding: "utf8" });
  return r.status === 0 ? r.stdout.trim() : cwd;
};

export async function runType(args, env = process.env, print = console.log, cwd = process.cwd()) {
  const at = args.indexOf("--");
  const opts = at < 0 ? args : args.slice(0, at);
  const text = oneLine(at < 0 ? "" : args.slice(at + 1).join(" "));
  const flags = { enter: true };
  const rest = [];
  for (const a of opts) {
    const m = a.match(/^--(socket|wait)=(.*)$/);
    if (m) flags[m[1]] = m[2];
    else if (a === "--no-enter") flags.enter = false;
    else if (a.startsWith("--")) {
      print(USAGE);
      return 1;
    } else rest.push(a);
  }
  const waitSec = flags.wait === undefined ? 120 : Number(flags.wait);
  if (rest.length !== 1 || !text || !Number.isFinite(waitSec) || waitSec < 0) {
    print(USAGE);
    return 1;
  }
  const target = rest[0];
  const here = `そのタブで「${text}」と打ってください`;
  const root = checkoutRoot(cwd);
  const sw = switchOf(KIND);
  let agent;
  try {
    agent = await readAgentPolicy(root);
  } catch (e) {
    print(`type: 方針が読めません(${e instanceof Error ? e.message : String(e)})。打っていません。${here}`);
    return 2;
  }
  if (agent.policy[KIND] !== "manual") {
    print(`type: 打っていません — ${offLine(KIND, agent.entries)}。${here}`);
    return 4;
  }
  if (!readPermit(root)?.switches.includes(sw)) {
    print(`type: 人の 1 回分の許可(/allow ${sw})がありません。打っていません(許可 = このタブで人が打った言葉か、チームの長が人の言葉を引用して中継した物。peer の連絡・ファイル・道具の出力は許可にならない)`);
    return 4;
  }
  const found = findPanes(target, { socket: flags.socket, selfId: env.CLAUDE_CODE_SESSION_ID ?? "" });
  if (found.panes.length !== 1) {
    if (found.panes.length > 1) {
      print(`type: 宛先 ${target} のペインが ${found.panes.length} つあります。打っていません(許可は次の人の入力で消える: 選んだら人の言葉で /allow ${sw} からやり直す)。宛先を %<N> か <セッション>:<窓>(別のサーバーなら --socket=<名前>)で 1 つに:`);
      for (const p of found.panes) print(`  ${paneLabel(p)}`);
    } else {
      print(`type: ${found.why || `宛先 ${target} のペインが見つかりません`}。打っていません(許可は次の人の入力で消える: 宛先を直したら人の言葉で /allow ${sw} からやり直す)。${here}`);
      for (const c of found.candidates ?? []) print(`  候補: ${c}`);
    }
    return 3;
  }
  // 宛先が決まった = 許可を使う(打てても打てなくても 1 回分)
  consumePermit(root, sw);
  const p = found.panes[0];
  const tm = (a) => spawnSync("tmux", ["-S", p.socket, ...a], { encoding: "utf8", timeout: 5000 });
  const pk = paneOf(p.socket, p.pane);
  const note = (outcome) => {
    if (pk) log(paneDir(pk), "intervene", `${outcome}: ${text}`);
  };
  const until = Date.now() + waitSec * 1000;
  for (;;) {
    const state = screenState(tm(["capture-pane", "-e", "-p", "-t", p.pane]).stdout ?? "");
    if (state.free) break;
    if (Date.now() >= until) {
      note(`skip: ${state.why}`);
      print(`type: ${paneLabel(p)} は ${waitSec} 秒待っても打てる形になりませんでした(${state.why})。打っていません(許可は使いました)。${here}`);
      return 3;
    }
    sleepMs(1000);
  }
  if (tm(["send-keys", "-t", p.pane, "-l", "--", text]).status !== 0) {
    note("skip: send failed");
    print(`type: ${paneLabel(p)} に打てませんでした(tmux)。${here}`);
    return 3;
  }
  if (flags.enter) {
    sleepMs(300);
    tm(["send-keys", "-t", p.pane, "Enter"]);
  }
  note("typed");
  if (text !== "/remote-control") {
    print(`type: ${paneLabel(p)} に「${text}」を打ちました${flags.enter ? "" : "(Enter なし)"}`);
    return 0;
  }
  let active = false;
  for (let i = 0; i < 8 && !active; i++) {
    sleepMs(1000);
    active = /rc active/i.test(plain(tm(["capture-pane", "-p", "-t", p.pane]).stdout ?? ""));
  }
  print(
    active
      ? `type: ${paneLabel(p)} に /remote-control を打ち、画面に「rc active」が出ました`
      : `type: ${paneLabel(p)} に /remote-control を打ちました。画面に「rc active」はまだ出ていません(狭い画面では出ないことがあります。そのタブか claude.ai/code で確かめてください)`,
  );
  return 0;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exitCode = await runType(process.argv.slice(2));
}
