// scripts/workflow/agent-terminal/compactSelf.mjs — pnpm compact:self "<残すこと>"
//
// エージェントが自分の会話の圧縮を頼むコマンド。どこで打っても使える(エージェントから見た約束は 1 つ):
//   - 自分のペインに打てる(AGENT_TERMINAL=tmux・tmux の中・hook が動いている)→ この返答が終わったら `/compact <残すこと>`
//     を打つ待つ役(waiter.mjs)を残し、「予約した。ここで返答を終える」と出す
//   - 打てない → `/compact <残すこと>` をユーザーに打ってもらう 1 行を出す(エラーにしない)
// 終了コード: 0(どちらも)/ 1 = 残すことが空。説明: scripts/workflow/agent-terminal/README.md

import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { HERE, currentPane, marks, oneLine, paneDir } from "./lib.mjs";

/** 予約できるか。{ mode: "queue", pane, prevIdle } | { mode: "fallback" } */
export function planCompactSelf(env = process.env) {
  const pane = currentPane(env);
  if (!pane) return { mode: "fallback" };
  const m = marks(paneDir(pane, env));
  // session = SessionStart、busy = UserPromptSubmit の hook がこのペインで動いた印。無ければ返答の終わりも分からない
  if (!m.session || !m.busy) return { mode: "fallback" };
  return { mode: "queue", pane, prevIdle: m.idle };
}

export function runCompactSelf(args, env = process.env, deps = { spawn, print: console.log }) {
  const focus = oneLine(args.join(" "));
  if (!focus) {
    deps.print('使い方: pnpm compact:self "<圧縮の後も残すこと(1〜3 行)>"');
    return 1;
  }
  const plan = planCompactSelf(env);
  if (plan.mode === "queue") {
    const child = deps.spawn(process.execPath, [path.join(HERE, "waiter.mjs"), "compact", `/compact ${focus}`, plan.prevIdle], {
      detached: true,
      stdio: "ignore",
      env,
    });
    child.unref?.();
    deps.print("予約しました: この返答が終わると /compact が入力されます。ここで返答を終えてください。");
  } else {
    deps.print(`自動では入力できません。次の 1 行をユーザーに打ってもらってください: /compact ${focus}`);
  }
  return 0;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exit(runCompactSelf(process.argv.slice(2)));
}
