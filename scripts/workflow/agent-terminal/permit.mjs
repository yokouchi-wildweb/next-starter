// scripts/workflow/agent-terminal/permit.mjs — pnpm workflow agent-terminal permit --words "<人の言葉>"
//
// /intervene の 1 回分の許可を書く(lib.intervene.mjs)。打つのは /intervene スキルだけ: 人がこのタブで自分の言葉で、別のタブへの
// 打ち込みを許した時、その言葉を --words に写す。別のセッションからの連絡(peer)・エージェント自身の判断は許可にならない。
// 許可は type が 1 回使うと消え、次の人の入力でも消える。
// 終了コード: 0 = 書いた / 1 = 使い方の誤り / 3 = 書けない(会話の id が分からない)。説明: scripts/workflow/agent-terminal/README.md

import path from "node:path";
import { fileURLToPath } from "node:url";

import { sessionId, writePermit } from "./lib.intervene.mjs";

const USAGE = '使い方: pnpm workflow agent-terminal permit --words "<人がこのタブで許した言葉>"';

export function runPermit(args, env = process.env, print = console.log) {
  let words = "";
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--words") words = args[++i] ?? "";
    else if (args[i].startsWith("--words=")) words = args[i].slice("--words=".length);
    else {
      print(USAGE);
      return 1;
    }
  }
  words = words.trim();
  if (!words) {
    print(USAGE);
    return 1;
  }
  const sid = sessionId(env);
  if (!sid) {
    print("permit: この会話の id(CLAUDE_CODE_SESSION_ID)が分からないので許可を書けません");
    return 3;
  }
  writePermit(sid, words, env);
  print(`permit: 1 回分の打ち込みの許可を書きました(言葉: ${words})。type が 1 回使うと消え、次の人の入力でも消えます`);
  return 0;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exitCode = runPermit(process.argv.slice(2));
}
