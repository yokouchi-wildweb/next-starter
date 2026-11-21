// scripts/workflow/context/facts.mjs — pnpm workflow context facts [--personal] [--fetch]
// 文脈のファイルの行ごとの事実を 1 行ずつ出す(/project-review と /meditate の材料)。読むだけで何も書かない。判断はしない。
// 既定 = このリポの自前の文脈、--personal = 個人の 2 ファイル(CLAUDE.local.md・~/.claude/CLAUDE.md)
// 終了コード: 0 = 出した / 2 = 引数の誤り・持ち主が決まらない。説明: scripts/workflow/context/README.md
import { collectFacts, formatLine, parseArgs, runAction } from "./lib.mjs";

runAction(() => {
  const { personal, fetch } = parseArgs(process.argv.slice(2));
  const facts = collectFacts({ cwd: process.cwd(), personal, fetch });
  console.log(`scope: ${facts.scope}`);
  for (const { target, lines } of facts.files) {
    console.log(`file: ${target.path} | owner:${target.owner} | lines:${lines.length}`);
    for (const line of lines) console.log(formatLine(line));
  }
});
