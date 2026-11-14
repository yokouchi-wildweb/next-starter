// scripts/workflow/agent-terminal/compactSelf.mjs — pnpm workflow agent-terminal compactSelf [--then continue|wait] "<残すこと>"
//
// エージェントが自分の会話の圧縮を頼むコマンド。どこで打っても使える(エージェントから見た約束は 1 つ):
//   - 自分のペインに打てる(AGENT_TERMINAL=tmux・tmux の中・hook が動いている)→ この返答が終わったら `/compact <残すこと>`
//     を打つ待つ役(lib.waiter.mjs)を残し、「予約した。ここで返答を終える」と出す
//   - 頼み先がある(AGENT_COMPACT_CMD)→ 自分では打たない。そのコマンドを、残すことを env AGENT_COMPACT_FOCUS に入れて呼び、
//     その出力を出す(打ち込むのは端末を持つ道具だけ)。呼べない・失敗 → 下の 1 行
//   - 端末は別の道具が持つ(AGENT_TERMINAL=none)で頼み先が無い → 下の 1 行(打たない)
//   - 打てない → `/compact <残すこと>` をユーザーに打ってもらう 1 行を出す(エラーにしない)
// --then = 圧縮の後に打つ 1 行の種類(continue = 読み返して続ける(既定)/ wait = 読み返して待つ)。待つ役が /compact を打つときに
// ペインの印 after に書き、hook.mjs の SessionStart が読む。頼み先があるとき・打てないときは使わない(後は頼み先の仕組み・既定の続き)
// 終了コード: 0(どちらも)/ 1 = 残すことが空・--then の値が違う。説明: scripts/workflow/agent-terminal/README.md

import { spawn, spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { HERE, compactHandoff, currentPane, marks, oneLine, paneDir } from "./lib.mjs";

/** 予約できるか。{ mode: "handoff", cmd, args, env } | { mode: "queue", pane, prevIdle } | { mode: "fallback" } */
export function planCompactSelf(env = process.env, focus = "") {
  const handoff = compactHandoff(env, focus);
  if (handoff) return { mode: "handoff", ...handoff };
  const pane = currentPane(env);
  if (!pane) return { mode: "fallback" };
  const m = marks(paneDir(pane, env));
  // session = SessionStart、busy = UserPromptSubmit の hook がこのペインで動いた印。無ければ返答の終わりも分からない
  if (!m.session || !m.busy) return { mode: "fallback" };
  return { mode: "queue", pane, prevIdle: m.idle };
}

const defaultDeps = {
  spawn,
  print: console.log,
  // 圧縮の頼み先を呼ぶ(AGENT_COMPACT_CMD)
  run: (cmd, args, env) => spawnSync(cmd, args, { env, encoding: "utf8" }),
};

/** 圧縮の後に打つ 1 行の種類 */
export const AFTER_COMPACT = ["continue", "wait"];

/** 引数から --then <値> / --then=<値> を抜く。{ then, rest } | null(値が無い・知らない値) */
export function parseThen(args) {
  const rest = [];
  let then = "continue";
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === "--then") then = args[++i] ?? "";
    else if (a.startsWith("--then=")) then = a.slice("--then=".length);
    else rest.push(a);
  }
  return AFTER_COMPACT.includes(then) ? { then, rest } : null;
}

export function runCompactSelf(args, env = process.env, deps = defaultDeps) {
  deps = { ...defaultDeps, ...deps };
  const parsed = parseThen(args);
  const focus = parsed ? oneLine(parsed.rest.join(" ")) : "";
  if (!focus) {
    deps.print('使い方: pnpm workflow agent-terminal compactSelf [--then continue|wait] "<圧縮の後も残すこと(1〜3 行)>"');
    return 1;
  }
  const plan = planCompactSelf(env, focus);
  if (plan.mode === "handoff") {
    const name = [plan.cmd, ...plan.args].join(" ");
    const r = deps.run(plan.cmd, plan.args, { ...env, ...plan.env });
    const out = `${r.stdout ?? ""}${r.stderr ?? ""}`.trim();
    if (r.error || r.status !== 0) {
      deps.print(`圧縮の頼み先(${name})に渡せませんでした${out ? `: ${out}` : ""}。次の 1 行をユーザーに打ってもらってください: /compact ${focus}`);
    } else {
      deps.print(out || `圧縮の頼み先(${name})に渡しました。ここで返答を終えてください。`);
    }
    return 0;
  }
  if (plan.mode === "queue") {
    const child = deps.spawn(process.execPath, [path.join(HERE, "lib.waiter.mjs"), "compact", `/compact ${focus}`, plan.prevIdle, parsed.then], {
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
  process.exitCode = runCompactSelf(process.argv.slice(2));
}
