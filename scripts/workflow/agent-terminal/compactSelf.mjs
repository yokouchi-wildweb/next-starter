// scripts/workflow/agent-terminal/compactSelf.mjs — pnpm workflow agent-terminal compactSelf "<残すこと>"
//
// エージェントが自分の会話の圧縮を頼むコマンド。どこで打っても使える(エージェントから見た約束は 1 つ):
//   - 自分のペインに打てる(AGENT_TERMINAL=tmux・tmux の中・hook が動いている)→ この返答が終わったら `/compact <残すこと>`
//     を打つ待つ役(lib.waiter.mjs)を残し、「予約した。ここで返答を終える」と出す
//   - チームの道具のタブ(TK_TEAM など)→ 打ち込みはその道具だけが受け持つ。`<チーム> compact <インスタンス> <タブ>` に
//     残すことを env TK_COMPACT_FOCUS で渡し、その出力を出す(統括のタブなら道具が focus ファイルに書いて返答の終わりに打つ。
//     手下のタブは道具が断る: 手下の圧縮は統括が決める)
//   - 打てない → `/compact <残すこと>` をユーザーに打ってもらう 1 行を出す(エラーにしない)
// 終了コード: 0(どちらも)/ 1 = 残すことが空。説明: scripts/workflow/agent-terminal/README.md

import { spawn, spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { HERE, currentPane, isDrivenByAnotherTool, marks, oneLine, paneDir } from "./lib.mjs";

/**
 * チームの道具のタブ(手元のチームツール。next-starter の仲間のリポと必ず一緒に使う)。
 * 渡し先が分かる(TK_TEAM / TK_INSTANCE / TK_TAB がそろう)ときだけ { team, instance, tab }、ほかは null
 */
export function teamTab(env = process.env) {
  const [team, instance, tab] = ["TK_TEAM", "TK_INSTANCE", "TK_TAB"].map((k) => (env[k] ?? "").trim());
  return team && instance && tab ? { team, instance, tab } : null;
}

/** 予約できるか。{ mode: "team", team, instance, tab } | { mode: "queue", pane, prevIdle } | { mode: "fallback" } */
export function planCompactSelf(env = process.env) {
  const team = teamTab(env);
  if (team) return { mode: "team", ...team };
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
  // チームの道具を呼ぶ(コマンド名 = TK_TEAM。~/.local/bin にある)
  run: (cmd, args, env) => spawnSync(cmd, args, { env, encoding: "utf8" }),
};

export function runCompactSelf(args, env = process.env, deps = defaultDeps) {
  deps = { ...defaultDeps, ...deps };
  const focus = oneLine(args.join(" "));
  if (!focus) {
    deps.print('使い方: pnpm workflow agent-terminal compactSelf "<圧縮の後も残すこと(1〜3 行)>"');
    return 1;
  }
  const plan = planCompactSelf(env);
  if (plan.mode === "team") {
    const r = deps.run(plan.team, ["compact", plan.instance, plan.tab], { ...env, TK_COMPACT_FOCUS: focus });
    const out = `${r.stdout ?? ""}${r.stderr ?? ""}`.trim();
    if (r.error || r.status !== 0) {
      deps.print(`チームの道具(${plan.team} compact)に渡せませんでした${out ? `: ${out}` : ""}。次の 1 行をユーザーに打ってもらってください: /compact ${focus}`);
    } else {
      deps.print(out || `${plan.team} compact に渡しました。ここで返答を終えてください。`);
    }
    return 0;
  }
  if (isDrivenByAnotherTool(env)) {
    // 渡し先の分からない古い形のチームのタブ(LOUNGE_ROLE など)
    deps.print(`このタブはチームの道具が動かしています。統括に圧縮を頼むか、次の 1 行をユーザーに打ってもらってください: /compact ${focus}`);
    return 0;
  }
  if (plan.mode === "queue") {
    const child = deps.spawn(process.execPath, [path.join(HERE, "lib.waiter.mjs"), "compact", `/compact ${focus}`, plan.prevIdle], {
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
