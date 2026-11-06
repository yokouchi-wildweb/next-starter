// scripts/agent-terminal/hook.mjs <start|busy|stop|precompact> — .claude/settings.json の hook
//
// ペインごとに、今どの会話がいるか・返答の始まりと終わり・圧縮の起こり方を記録する(待つ役 waiter.mjs が読む)。
//   start (SessionStart)      — そのペインの会話の id と、端末の案内(AGENT_TERMINAL.<値>.md)を標準出力へ(= 文脈に入る)。手で打った /compact の後(source=compact、直前の PreCompact が manual)
//                               なら、入力欄が空いたら「続けてください」を打つ待つ役を残す
//   busy (UserPromptSubmit)   — 返答の始まりの時刻
//   stop (Stop)               — 返答の終わりの時刻
//   precompact (PreCompact)   — 圧縮の起こり方(manual | auto)。auto は返答の途中で起きてそのまま続くので、続きは打たない
// 標準出力に出すのは start の案内だけ(UserPromptSubmit / SessionStart の出力は文脈に入る)。AGENT_TERMINAL が tmux でない・
// tmux の外・別の道具が動かすタブ・失敗したときは何も出さず何もしない。常に exit 0。説明: scripts/agent-terminal/README.md

import { spawn } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";

import { HERE, currentPane, guideFile, paneDir, readAgentTerminal, readMark, writeMark } from "./lib.mjs";

const CONTINUE_TEXT = "続けてください";

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
  const pane = currentPane();
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
      const manual = readMark(dir, "precompact") === "manual";
      writeMark(dir, "precompact", "");
      if (input.source === "compact" && manual && session) {
        const child = spawn(process.execPath, [path.join(HERE, "waiter.mjs"), "continue", CONTINUE_TEXT], {
          detached: true,
          stdio: "ignore",
          env: process.env,
        });
        child.unref();
      }
    }
  }
} catch {
  // 記録できないだけ。セッションは止めない
}
process.exit(0);
