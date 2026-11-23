// scripts/workflow/agent-terminal/open.mjs — pnpm workflow agent-terminal open [--cwd=<dir>] [--name=<名前>] [--socket=<名前>] [-- <命令…>]
//
// /reinforce の open: 新しい tmux のセッションを切り離して(-d)作り、cwd で命令を走らせる。既定の命令は
// `claude --remote-control <名前>`(新しい通常セッション、Remote Control つき)、`--` の後があればその命令(議会・チームの起動など。
// この道具はチームを知らない。命令が終わってもタブは残す: 終わった印の 1 行の後にシェル)。打った人の画面は奪わない(attach / switch-client しない)。
// サーバー: --socket=<名前> = tmux -L <名前> / 呼んだ会話が tmux の中 = 同じサーバー / ほか = 既定のサーバー(AGENT_TERMINAL=none でも開く)。
// セッション名 = --name、無ければ cwd のフォルダ名(使える字だけ、重なれば -2、-3 …)。
// 出す 1 行: どこに開いたかと attach の命令。tmux が無ければ開かず、人が打つ 1 行を出す。
// 命令つきの時は開いた後に最長 5 秒、命令の終わった印を見る: 出たら「すぐ終わりました」とその画面の最後の行を出す(開けたとは言わない)。
// 終了コード: 0 = 開いた(命令が exit 0 ですぐ終わった時も)/ 1 = 使い方の誤り / 3 = 開けない(tmux が無い・tmux が失敗)/
// 4 = 開いたが命令がすぐ失敗した(exit 0 以外)。説明: scripts/workflow/agent-terminal/README.md

import { spawnSync } from "node:child_process";
import { existsSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { hasTmux, serverOf, tmuxAt } from "./lib.reinforce.mjs";

const USAGE = "使い方: pnpm workflow agent-terminal open [--cwd=<dir>] [--name=<名前>] [--socket=<名前>] [-- <命令…>]";

const quote = (s) => (/^[A-Za-z0-9_./:=@%+-]+$/.test(s) ? s : `'${s.replace(/'/g, `'\\''`)}'`);
const cleanName = (s) => s.replace(/[^A-Za-z0-9._-]+/g, "-").replace(/^-+|-+$/g, "") || "session";
const ENDED = /^\(命令が終わりました: exit (\d+)\)$/;

// endedOf(server, name, waitMs) → { code, tail } when the pane shows the command's end mark within waitMs (polled every 0.5 s), else null.
// tail = the last lines before the mark (up to 8, blank ones dropped)
function endedOf(server, name, waitMs) {
  const until = Date.now() + waitMs;
  for (;;) {
    const lines = (tmuxAt(server, ["capture-pane", "-p", "-J", "-S", "-200", "-t", name]).stdout ?? "").split("\n").map((l) => l.trimEnd());
    const at = lines.findIndex((l) => ENDED.test(l));
    if (at >= 0) return { code: Number(lines[at].match(ENDED)[1]), tail: lines.slice(0, at).filter(Boolean).slice(-8) };
    if (Date.now() >= until) return null;
    spawnSync("sleep", ["0.5"]);
  }
}

export function runOpen(args, env = process.env, print = console.log, waitMs = 5000) {
  const at = args.indexOf("--");
  const opts = at < 0 ? args : args.slice(0, at);
  const command = at < 0 ? [] : args.slice(at + 1);
  const flags = {};
  for (const a of opts) {
    const m = a.match(/^--(cwd|name|socket)=(.*)$/);
    if (!m) {
      print(USAGE);
      return 1;
    }
    flags[m[1]] = m[2];
  }
  if (at >= 0 && command.length === 0) {
    print(USAGE);
    return 1;
  }
  const cwd = path.resolve(flags.cwd || process.cwd());
  if (!existsSync(cwd) || !statSync(cwd).isDirectory()) {
    print(`open: 場所がありません: ${cwd}`);
    return 1;
  }
  let name = cleanName(flags.name || path.basename(cwd));
  const line = command.length ? command.map(quote).join(" ") : `claude --remote-control ${quote(name)}`;
  if (!hasTmux()) {
    print(`open: tmux が無いので開いていません。人が新しい端末で打つ 1 行: cd ${quote(cwd)} && ${line}`);
    return 3;
  }
  const server = serverOf(flags.socket, env);
  const taken = new Set((tmuxAt(server, ["list-sessions", "-F", "#{session_name}"]).stdout ?? "").split("\n").filter(Boolean));
  const base = name;
  for (let n = 2; taken.has(name); n++) name = `${base}-${n}`;
  const run = command.length ? line : `claude --remote-control ${quote(name)}`;
  // 命令が終わってもタブは残す(出力を人が読める): 終わった印の 1 行の後にシェル
  const body = command.length ? `${run}; s=$?; echo; echo "(命令が終わりました: exit $s)"; exec "\${SHELL:-bash}"` : run;
  const r = tmuxAt(server, ["new-session", "-d", "-s", name, "-c", cwd, body]);
  if (r.status !== 0) {
    print(`open: tmux が開けませんでした(${(r.stderr || "").trim() || `exit ${r.status}`})。人が新しい端末で打つ 1 行: cd ${quote(cwd)} && ${run}`);
    return 3;
  }
  const where = `${server.label} のセッション ${name}(cwd ${cwd}、${command.length ? `命令 ${run}` : `Remote Control の名前 ${name}`})`;
  const ended = command.length ? endedOf(server, name, waitMs) : null;
  if (ended) {
    print(`open: 命令がすぐ終わりました(exit ${ended.code}) — ${where}。画面の最後:${ended.tail.length ? "" : " (出力なし)"}`);
    for (const l of ended.tail) print(`  | ${l}`);
    print(`見る: ${server.label} attach -t ${quote(name)}`);
    return ended.code === 0 ? 0 : 4;
  }
  print(`open: 開きました — ${where}。見る: ${server.label} attach -t ${quote(name)}`);
  return 0;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exitCode = runOpen(process.argv.slice(2));
}
