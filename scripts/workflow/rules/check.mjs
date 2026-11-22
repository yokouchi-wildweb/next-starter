// scripts/workflow/rules/check.mjs — 段階 ship の検査(phase.json): CLAUDE.md と .claude/rules/core の決まりのテスト + 大きさ(字数の線、size.mjs)+ 書式(札・README・対応表、format.mjs)+ paths の覆い(coverage.mjs)+ 生成物(generated.mjs)+ 同じ名前の .ts / .tsx を置かない(sameBasename)
import { spawnSync } from "node:child_process";
import { join } from "node:path";

import { phaseTestsOf } from "../../runner/phases/scan.mjs";

const repo = join(import.meta.dirname, "../../..");
// 回すテストの一覧は phase.json の tests(pnpm test はそれを回さない: 段階 1 回、D389)
const r = spawnSync(process.execPath, ["--test", ...phaseTestsOf(import.meta.dirname).map((f) => join(repo, f))], { stdio: "inherit" });
const size = spawnSync(process.execPath, [join(import.meta.dirname, "size.mjs")], { stdio: "inherit" });
const format = spawnSync(process.execPath, [join(import.meta.dirname, "format.mjs")], { stdio: "inherit" });
const coverage = spawnSync(process.execPath, [join(import.meta.dirname, "coverage.mjs")], { stdio: "inherit" });
const generated = spawnSync(process.execPath, [join(import.meta.dirname, "generated.mjs")], { stdio: "inherit" });
process.exitCode = (r.status ?? 1) || (size.status ?? 1) || (format.status ?? 1) || (coverage.status ?? 1) || (generated.status ?? 1);
