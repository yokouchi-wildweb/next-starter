// scripts/workflow/agent-terminal/compactPlan.mjs — pnpm workflow agent-terminal compactPlan
//
// 圧縮(/coffee-break)の最初の一歩。この会話の「足す手順」「引き継ぎの一時ファイルの場所」「続きの既定」「打つ者」を出す。
// スキルは環境で分かれず、この出力に従う(分かれ道はこのフォルダの中だけ)。
//   - 足す手順・続きの既定 = 会話を束ねる道具が渡す AGENT_COMPACT_CONTEXT(無ければ足す手順なし・続きは continue)
//   - 一時ファイル = 記録の置き場の handoff/<CLAUDE_CODE_SESSION_ID>.md(圧縮の後の SessionStart が読み戻して消す)
//   - 打つ者 = 頼み先(AGENT_COMPACT_CMD)/ このペインの待つ役 / ユーザー(compactSelf と同じ判断)
// 終了コード: 0(会話の id が分からない時も handoff: none で続ける)。説明: scripts/workflow/agent-terminal/README.md

import path from "node:path";
import { fileURLToPath } from "node:url";

import { planCompactSelf } from "./compactSelf.mjs";
import { handoffFile, readCompactContext, sessionOf } from "./lib.mjs";

const TYPED_BY = {
  handoff: "the tool that runs this session (AGENT_COMPACT_CMD)",
  queue: "this pane's waiter, when this turn ends",
  fallback: "the user (compactSelf prints the line to show them)",
};

export function runCompactPlan(env = process.env, print = console.log) {
  const session = sessionOf(env);
  const file = handoffFile(session, env);
  const ctx = readCompactContext(env);
  const then = ctx.then ?? "continue";
  // 会話の id が分からなくても止めない: 引き継ぎを書かないだけで、compactSelf は handoff 無しで圧縮できる(README「compactSelf」)
  const lines = [file ? `handoff: ${file}` : "handoff: none(会話の id CLAUDE_CODE_SESSION_ID が分からないので引き継ぎは書かない。圧縮はできる)"];
  if (ctx.error) lines.push(`context: ignored — ${ctx.error}`);
  lines.push(...(ctx.prepare.length > 0 ? ctx.prepare.map((p) => `prepare: ${p}`) : ["prepare: none"]));
  lines.push(`then: ${then}`);
  lines.push(`typed by: ${TYPED_BY[planCompactSelf(env).mode]}`);
  lines.push(`next: pnpm workflow agent-terminal compactSelf --then ${then} "<one line: what to re-read first>"`);
  print(lines.join("\n"));
  return 0;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exitCode = runCompactPlan();
}
