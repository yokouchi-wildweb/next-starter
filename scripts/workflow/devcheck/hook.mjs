// scripts/workflow/devcheck/hook.mjs — .claude/settings.json の PreToolUse のフック(許可の層、1 本)
//   標準入力の JSON → 判定(lib.grant.mjs の decide)→ deny / allow の JSON 1 行、または何も出さない。
//   壊れた時(入力が読めない・方針が読めない・例外)は何も出さず exit 0(= 普段どおり聞かれる。セッションは止めない)。
//   説明: scripts/workflow/devcheck/README.md「許可の層」
import path from "node:path";
import { fileURLToPath } from "node:url";

import { adaptClaude, decide, needsPolicy, realDeps, toClaudeOutput } from "./lib.grant.mjs";
import { loadPolicy } from "./lib.kinds.mjs";

const readStdin = async () => {
  if (process.stdin.isTTY) return null;
  let raw = "";
  for await (const chunk of process.stdin) raw += chunk;
  try {
    return JSON.parse(raw || "null");
  } catch {
    return null;
  }
};

try {
  const input = await readStdin();
  const req = adaptClaude(input);
  if (req) {
    const toolDir = path.dirname(fileURLToPath(import.meta.url));
    const projectDir = process.env.CLAUDE_PROJECT_DIR || (typeof input.cwd === "string" ? input.cwd : process.cwd());
    let deps = realDeps({ projectDir, toolDir, env: process.env, policy: null });
    if (needsPolicy(req, deps)) {
      let policy = null;
      try {
        policy = await loadPolicy(toolDir);
      } catch {
        policy = null;
      }
      deps = realDeps({ projectDir, toolDir, env: process.env, policy });
    }
    let decision = null;
    try {
      decision = decide(req, deps);
    } catch {
      // 方針が読めない等: 固定の止めだけはもう一度見る(止めは方針に依らない)
      decision = decide(req, { ...deps, grant: false });
    }
    const out = toClaudeOutput(decision);
    if (out) process.stdout.write(`${out}\n`);
  }
} catch {
  // 何も出さない
}
process.exitCode = 0;
