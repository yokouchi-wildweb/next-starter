// scripts/workflow/memory/facts.mjs — pnpm workflow memory facts [--dir <path>]
// このリポの auto-memory の事実を 1 件 1 行で出す(/meditate の材料)。読むだけで何も書かない。判断はしない。
// 終了コード: 0 = 出した(置き場が無い時も)/ 2 = 引数の誤り・正本が読めない。説明: scripts/workflow/memory/README.md
import { collectFacts, formatMemo, parseArgs, runAction } from "./lib.mjs";

runAction(() => {
  const { dir } = parseArgs(process.argv.slice(2));
  const facts = collectFacts({ cwd: process.cwd(), dirFlag: dir });
  console.log(`dir: ${facts.dir}`);
  if (!facts.exists) {
    console.log("none");
    return;
  }
  console.log(`header: ${facts.header}`);
  console.log(`memos: ${facts.memos.length}`);
  for (const m of facts.memos) console.log(formatMemo(m));
  for (const n of facts.indexOnly) console.log(`index-only: ${n}`);
});
