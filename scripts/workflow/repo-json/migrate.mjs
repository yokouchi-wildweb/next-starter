// scripts/workflow/repo-json/migrate.mjs — pnpm workflow repo-json migrate [--tier root|middle|leaf] [--dry-run]
// 古い形(.claude/rules/project.md の fork_id: / downstream: の 2 行)を repo.json へ移し、2 行を消す。
// downstream: が無い・読めない = 止める(exit 2、--tier で段を決めてもう一度)。説明: scripts/workflow/repo-json/README.md
import { RepoJsonError, migrate, runAction } from "./lib.mjs";

runAction((args) => {
  let tier = null;
  let dryRun = false;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--dry-run") dryRun = true;
    else if (args[i] === "--tier") tier = args[++i] ?? "";
    else if (args[i].startsWith("--tier=")) tier = args[i].slice("--tier=".length);
    else throw new RepoJsonError(`知らない引数 ${args[i]}(--tier root|middle|leaf / --dry-run)`);
  }
  const { values, removedLines } = migrate(process.cwd(), { tier, dryRun });
  console.log(`${dryRun ? "(書かない)" : ""}repo.json: repo_id = ${JSON.stringify(values.repo_id)}, tier = ${JSON.stringify(values.tier)}`);
  console.log(`project.md から消す行: ${removedLines.length ? removedLines.join(" / ") : "(なし)"}`);
});
