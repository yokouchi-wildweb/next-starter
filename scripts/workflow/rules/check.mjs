// scripts/workflow/rules/check.mjs — 門 ship の検査(gate.json): CLAUDE.md と .claude/rules/core の決まりのテスト(= pnpm check rules)
import { spawnSync } from "node:child_process";
import { join } from "node:path";

const r = spawnSync(process.execPath, ["--test", join(import.meta.dirname, "coreRules.test.mjs")], { stdio: "inherit" });
process.exitCode = r.status ?? 1;
