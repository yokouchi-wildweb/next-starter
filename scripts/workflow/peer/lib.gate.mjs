// scripts/workflow/peer/lib.gate.mjs
//
// peer を使えるか。判定は agent-terminal と同じ読み手(AGENT_TERMINAL の値が tmux で、tmux の中)。
// チームの道具のタブでは使わない(連絡はチームの道具が受け持つ)。自分 = CLAUDE_CODE_SESSION_ID。
// 説明: scripts/workflow/peer/README.md

import { isDrivenByAnotherTool, readAgentTerminal } from "../agent-terminal/lib.mjs";

/** { ok: true, selfId } | { ok: false, reason }(reason = そのまま出す 1 行) */
export function checkGate(env = process.env) {
  if (isDrivenByAnotherTool(env)) {
    return { ok: false, reason: "peer: チームの道具のタブでは使いません(連絡はそのチームの道具が受け持ちます)。何も送っていません" };
  }
  if (readAgentTerminal(env) !== "tmux") {
    return { ok: false, reason: "peer: AGENT_TERMINAL が tmux でないので使えません。何も送っていません(相手への用件は人に伝えてください)" };
  }
  if (!(env.TMUX ?? "").split(",")[0] || !/^%\d+$/.test(env.TMUX_PANE ?? "")) {
    return { ok: false, reason: "peer: tmux の外のセッションなので使えません。何も送っていません(相手への用件は人に伝えてください)" };
  }
  const selfId = (env.CLAUDE_CODE_SESSION_ID ?? "").trim();
  if (!/^[A-Za-z0-9-]+$/.test(selfId)) {
    return { ok: false, reason: "peer: 自分のセッション id(CLAUDE_CODE_SESSION_ID)が分からないので使えません。何も送っていません" };
  }
  return { ok: true, selfId };
}
