// scripts/workflow/peer/hook.mjs <start|cwd|prompt|bell> — .claude/settings.json のフック(本体は lib.hook.mjs の runHook)
//   start = SessionStart / cwd = CwdChanged / prompt = UserPromptSubmit / bell = FileChanged(asyncRewake)。説明: scripts/workflow/peer/README.md
import { runHook } from "./lib.hook.mjs";

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

let result = { stdout: "", stderr: "", code: 0 };
try {
  result = runHook(process.argv[2] ?? "", await readStdin());
} catch {
  // 何も出さない。セッションは止めない
}
if (result.stdout) process.stdout.write(result.stdout);
if (result.stderr) process.stderr.write(result.stderr);
process.exitCode = result.code;
