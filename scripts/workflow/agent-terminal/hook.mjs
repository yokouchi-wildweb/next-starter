// scripts/workflow/agent-terminal/hook.mjs <start|busy|stop|precompact> — .claude/settings.json の hook
//
// ペインごとに、今どの会話がいるか・返答の始まりと終わり・圧縮の起こり方を記録する(待つ役 lib.waiter.mjs が読む)。
//   start (SessionStart)      — そのペインの会話の id と、端末の案内(AGENT_TERMINAL.<値>.md)を標準出力へ(= 文脈に入る)。手で打った /compact の後(source=compact、直前の PreCompact が manual)
//                               なら、入力欄が空いたら続きの 1 行を打つ待つ役を残す。1 行は印 after(compactSelf の --then を待つ役が書く)
//                               で選ぶ: wait = 読み返して待つ / ほか = 読み返して続ける。印はどの start でも消す
//                               圧縮の後(source=compact)は、端末に関係なく引き継ぎの一時ファイル(compactPlan の場所)を読み戻して
//                               文脈へ出し、消す(一度きり。古い物は読まない)。どの start でも古い一時ファイルを掃除する
//   busy (UserPromptSubmit)   — 返答の始まりの時刻。/intervene の 1 回分の許可を消す(端末に関係なく: 許可は同じ番の中だけ、lib.intervene.mjs)
//   stop (Stop)               — 返答の終わりの時刻
//   precompact (PreCompact)   — 圧縮の起こり方(manual | auto)。auto は返答の途中で起きてそのまま続くので、続きは打たない
// 標準出力に出すのは start の案内と読み戻す引き継ぎだけ(UserPromptSubmit / SessionStart の出力は文脈に入る)。記録・案内・打ち込みは
// AGENT_TERMINAL=tmux で tmux の中のときだけ。失敗したときは何も出さない。常に exit 0。説明: scripts/workflow/agent-terminal/README.md

import { spawn } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";

import { HERE, currentPane, guideFile, handoffFile, paneDir, readAgentTerminal, readMark, sweepHandoffs, takeHandoff, writeMark } from "./lib.mjs";
import { clearPermit } from "./lib.intervene.mjs";

// 圧縮の後に打つ 1 行(印 after の値ごと。無い・知らない値 = continue)
const AFTER_TEXT = {
  continue: "必要な情報を読み返して作業を続行。",
  wait: "必要な情報を読み返して待機。",
};

// 読み戻す引き継ぎの見出し(続きの種類ごと)。文脈に入る文なのでエージェント向けの英語
const HANDOFF_HEAD = {
  continue: "re-read the files it names, then continue the work",
  wait: "re-read the files it names, then wait for the user",
  none: "re-read the files it names",
};

/** 圧縮の後の引き継ぎ(端末に関係なく)。出す文か "" */
const handoffText = (input) => {
  sweepHandoffs();
  if (input.source !== "compact") return "";
  const h = takeHandoff(handoffFile(typeof input.session_id === "string" ? input.session_id : ""));
  return h ? `# compact handoff (written by this session right before the compact: ${HANDOFF_HEAD[h.then]})\n${h.body}\n` : "";
};

const readStdin = async () => {
  if (process.stdin.isTTY) return {};
  let raw = "";
  for await (const chunk of process.stdin) raw += chunk;
  try {
    return JSON.parse(raw || "{}");
  } catch {
    return {};
  }
};

try {
  const event = process.argv[2] ?? "";
  const input = await readStdin();
  // 人の次の入力で /intervene の許可は終わる(打ち込みの許可は許した番の中だけ)
  if (event === "busy" && typeof input.session_id === "string") clearPermit(input.session_id, "the next human input");
  const pane = currentPane();
  // 引き継ぎは端末より先に用意する(打ち込みがあるかどうかに関係なく読み戻す)
  let handoff = "";
  if (event === "start") {
    try {
      handoff = handoffText(input);
    } catch {
      // 読み戻せないだけ
    }
  }
  if (pane) {
    const dir = paneDir(pane);
    const now = String(Date.now());
    if (event === "busy") writeMark(dir, "busy", now);
    else if (event === "stop") writeMark(dir, "idle", now);
    else if (event === "precompact") writeMark(dir, "precompact", input.trigger === "auto" ? "auto" : "manual");
    else if (event === "start") {
      const session = typeof input.session_id === "string" ? input.session_id : "";
      writeMark(dir, "session", session);
      // この端末でできることの案内(どの source でも。圧縮の後も入れ直す)
      process.stdout.write(readFileSync(guideFile(readAgentTerminal()), "utf8"));
      if (handoff) process.stdout.write(handoff);
      handoff = "";
      const manual = readMark(dir, "precompact") === "manual";
      const after = readMark(dir, "after");
      const text = AFTER_TEXT[after] ?? AFTER_TEXT.continue;
      writeMark(dir, "precompact", "");
      writeMark(dir, "after", "");
      // 印 after = none(compactSelf --then none、または /compact を打つ道具が afterCompact で書いた)= 何も打たない
      if (input.source === "compact" && manual && session && after !== "none") {
        const child = spawn(process.execPath, [path.join(HERE, "lib.waiter.mjs"), "continue", text], {
          detached: true,
          stdio: "ignore",
          env: process.env,
        });
        child.unref();
      }
    }
  }
  // 端末に頼れないとき(tmux でない・tmux の外)も引き継ぎだけは出す
  if (handoff) process.stdout.write(handoff);
} catch {
  // 記録できないだけ。セッションは止めない
}
process.exit(0);
