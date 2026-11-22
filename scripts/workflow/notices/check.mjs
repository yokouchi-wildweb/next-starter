// scripts/workflow/notices/check.mjs — 段階 ship の検査(phase.json): notice・本文の欄・取り込みの道具のテスト
import { spawnSync } from "node:child_process";
import { join } from "node:path";

import { gateTestsOf } from "../../runner/phases/scan.mjs";

const here = import.meta.dirname;
const repo = join(here, "../../..");
// 回すテストの一覧は phase.json の tests(pnpm test はそれを回さない: 段階 1 回、D389)
const files = gateTestsOf(here).map((f) => join(repo, f));
const r = spawnSync(process.execPath, ["--test", ...files], { cwd: repo, stdio: "inherit" });
process.exitCode = r.status ?? 1;
