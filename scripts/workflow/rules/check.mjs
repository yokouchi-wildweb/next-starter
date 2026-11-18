// scripts/workflow/rules/check.mjs — 門 ship の検査(gate.json): CLAUDE.md と .claude/rules/core の決まりのテスト + 大きさ(字数の線と場面の合計、size.mjs)+ 書式(札・README・対応表、format.mjs)+ paths の覆い(coverage.mjs)+ 同じ名前の .ts / .tsx を置かない(sameBasename)
import { spawnSync } from "node:child_process";
import { join } from "node:path";

const r = spawnSync(process.execPath, ["--test", join(import.meta.dirname, "coreRules.test.mjs"), join(import.meta.dirname, "ruleSize.test.mjs"), join(import.meta.dirname, "ruleFormat.test.mjs"), join(import.meta.dirname, "ruleCoverage.test.mjs"), join(import.meta.dirname, "sameBasename.test.mjs")], { stdio: "inherit" });
const size = spawnSync(process.execPath, [join(import.meta.dirname, "size.mjs")], { stdio: "inherit" });
const format = spawnSync(process.execPath, [join(import.meta.dirname, "format.mjs")], { stdio: "inherit" });
const coverage = spawnSync(process.execPath, [join(import.meta.dirname, "coverage.mjs")], { stdio: "inherit" });
process.exitCode = (r.status ?? 1) || (size.status ?? 1) || (format.status ?? 1) || (coverage.status ?? 1);
