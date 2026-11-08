// scripts/workflow/peer/lib.gate.mjs
//
// peer を使えるか。判定は agent-terminal と同じ読み手(AGENT_TERMINAL の値が tmux で、tmux の中)。自分 = CLAUDE_CODE_SESSION_ID。
// チームの道具のタブでも使える(統括のタブも送受信する)。受け持つ箱 = 環境変数 PEER_BOXES。
// 説明: scripts/workflow/peer/README.md

import { readAgentTerminal } from "../agent-terminal/lib.mjs";
import { isInstanceBox } from "./lib.store.mjs";

/** { ok: true, selfId } | { ok: false, reason }(reason = そのまま出す 1 行) */
export function checkGate(env = process.env) {
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

/**
 * このセッションが受け持つインスタンス ID の箱(PEER_BOXES: `<種類>/<ID>` をカンマか空白で区切る)。
 * 戻り値 { keys: 使える鍵(重複なし、書いた順), dropped: 使えない値 }。1 段の鍵(ほかの会話の箱)は受け持てない
 * PEER_BOXES はそれを渡されたセッションだけのもの: 立ち上げる道具は子のタブに渡さない(README)
 */
export function heldBoxes(env = process.env) {
  const keys = [];
  const dropped = [];
  for (const v of String(env.PEER_BOXES ?? "").split(/[\s,]+/).filter(Boolean)) {
    if (!isInstanceBox(v)) dropped.push(v);
    else if (!keys.includes(v)) keys.push(v);
  }
  return { keys, dropped };
}
