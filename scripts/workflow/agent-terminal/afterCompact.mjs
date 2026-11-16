// scripts/workflow/agent-terminal/afterCompact.mjs — pnpm workflow agent-terminal afterCompact <continue|wait|none> [--socket=<path> --pane=%<N>]
//
// /compact を自分で打つ道具(会話を束ねる道具)が、打つ前にそのペインの印 after を書く。圧縮の後に hook.mjs がこの印で
// 続きの 1 行を打ち分ける(continue = 読み返して続ける / wait = 読み返して待つ / none = 何も打たない)。
// 印は次の SessionStart で消える(どの source でも)ので、/compact を打つ直前に書く。
// ペイン = --socket(tmux の socket のパス)と --pane(%N)。省けば今のペイン(AGENT_TERMINAL=tmux・tmux の中)。
// 終了コード: 0 = 書いた / 1 = 使い方の誤り / 3 = 書けない(ペインが決まらない)。説明: scripts/workflow/agent-terminal/README.md

import path from "node:path";
import { fileURLToPath } from "node:url";

import { AFTER_COMPACT, currentPane, paneDir, paneOf, writeMark } from "./lib.mjs";

const USAGE = "使い方: pnpm workflow agent-terminal afterCompact <continue|wait|none> [--socket=<tmux の socket のパス> --pane=%<N>]";

export function runAfterCompact(args, env = process.env, print = console.log) {
  const flags = {};
  const rest = [];
  for (const a of args) {
    const m = a.match(/^--(socket|pane)=(.*)$/);
    if (m) flags[m[1]] = m[2];
    else rest.push(a);
  }
  const [then] = rest;
  if (rest.length !== 1 || !AFTER_COMPACT.includes(then) || Boolean(flags.socket) !== Boolean(flags.pane)) {
    print(USAGE);
    return 1;
  }
  const pane = flags.socket ? paneOf(flags.socket, flags.pane) : currentPane(env);
  if (!pane) {
    print("afterCompact: ペインが決まりません(--socket と --pane を渡すか、tmux の中で AGENT_TERMINAL=tmux)。何も書いていません");
    return 3;
  }
  writeMark(paneDir(pane, env), "after", then);
  print(`afterCompact: ${pane.pane} の圧縮の後 = ${then}`);
  return 0;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exitCode = runAfterCompact(process.argv.slice(2));
}
