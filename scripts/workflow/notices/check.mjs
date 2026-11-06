// scripts/workflow/notices/check.mjs — 門 ship の検査(gate.json): notice・出荷索引・取り込みの道具のテスト(= pnpm test:notices)
import { spawnSync } from "node:child_process";
import { join } from "node:path";

const here = import.meta.dirname;
const repo = join(here, "../../..");
const files = [
  ...["notices", "hotfixCheck", "pickCheck", "checkpointCheck", "shippedIndex"].map((n) => join(here, `${n}.test.mjs`)),
  join(repo, ".claude/skills/flux/incoming.test.mjs"),
];
const r = spawnSync(process.execPath, ["--test", ...files], { cwd: repo, stdio: "inherit" });
process.exitCode = r.status ?? 1;
