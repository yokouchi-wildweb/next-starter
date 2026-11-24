// scripts/workflow/repo-json/migrate.mjs — pnpm workflow repo-json migrate [--tier root|middle|leaf] [--dry-run]
// 古い形を移す: 平らな repo.json → 入れ子(入口の鍵の改名、廃止した鍵を落とす、知らない鍵は止める)/ project.md の fork_id: / downstream: の
// 2 行 → repo.json(downstream: が無い・読めない = 止める、--tier)。2 回目は何も書かない。説明: scripts/workflow/repo-json/README.md
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
  const { values, removedLines, renamed, dropped, wrote } = migrate(process.cwd(), { tier, dryRun });
  console.log(`${dryRun ? "(書かない)" : ""}repo.json: repo_id = ${JSON.stringify(values.repo_id)}, tier = ${JSON.stringify(values.tier)}${wrote ? "" : "(移すものなし、何も書かない)"}`);
  console.log(`改めた鍵: ${renamed.length ? renamed.join(" / ") : "(なし)"}`);
  console.log(`落とした鍵: ${dropped.length ? dropped.join(" / ") : "(なし)"}`);
  console.log(`project.md から消す行: ${removedLines.length ? removedLines.join(" / ") : "(なし)"}`);
});
