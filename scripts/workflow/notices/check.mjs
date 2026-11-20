// scripts/workflow/notices/check.mjs — 門 ship の検査(gate.json): notice・本文の欄・取り込みの道具のテスト
import { spawnSync } from "node:child_process";
import { join } from "node:path";

const here = import.meta.dirname;
const repo = join(here, "../../..");
const files = [
  ...["notices", "lib.hotfixGaps", "hotfixApply", "pickCheck", "safePoint", "noticeFields", "reorder"].map((n) => join(here, `${n}.test.mjs`)),
  join(repo, ".claude/skills/flux/incoming.test.mjs"),
];
const r = spawnSync(process.execPath, ["--test", ...files], { cwd: repo, stdio: "inherit" });
process.exitCode = r.status ?? 1;
