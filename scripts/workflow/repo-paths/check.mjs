// scripts/workflow/repo-paths/check.mjs — 段階 ship の検査(phase.json、watch = Tier1 の名を含むパス): リポの名を付けたパスが repo_records の所の外に無いか
// Tier1 だけで回す(D308): fork では業務の名とリポの名が紛れるので掛けない(1 行で飛ばす)。決まり: CLAUDE.md design_check・core/ownership.md repo_records
// 直し方: リポの名を付けない置き場にする(どの変更形式か決めて宣言する: CLAUDE.md CHANGE_TYPES design_check)
import { execFileSync } from "node:child_process";
import { join } from "node:path";

import { readForkIdentity } from "../../../src/lib/forkOwnership/node.mjs";
import { repoNamedProblems } from "./lib.mjs";

const repo = join(import.meta.dirname, "../../..");
const identity = readForkIdentity(repo);
if (!identity.isTier1 || identity.own === null) {
  console.log("repo-paths: Tier1 でないので飛ばす(fork には掛けない)");
} else {
  const paths = execFileSync("git", ["-c", "core.quotePath=false", "ls-files"], { cwd: repo, encoding: "utf8" }).split("\n").filter(Boolean);
  const problems = repoNamedProblems(paths, [identity.own]);
  if (problems.length === 0) {
    console.log(`repo-paths: リポの名(${identity.own})を付けたパスは記録の所だけ`);
  } else {
    console.error("repo-paths: リポの名を付けたパスが repo_records の所の外にある(リポの名を付けた置き場は作らない: CLAUDE.md CHANGE_TYPES design_check、core/ownership.md repo_records):");
    for (const { path } of problems) console.error(`  ${path}`);
    process.exitCode = 1;
  }
}
