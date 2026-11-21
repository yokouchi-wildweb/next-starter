// scripts/workflow/memory/header.mjs — pnpm workflow memory header [--apply] [--dir <path>]
// MEMORY.md の先頭の区画を正本(.claude/skills/meditate/header.md)と比べる。既定は状態と差分を見せるだけ、
// --apply で区画の中だけを正本に戻す(区画が無ければ先頭に足す、MEMORY.md が無ければ区画だけで作る)。区画の外は変えない。
// 終了コード: 0 = 出した・書いた(置き場が無い時は何もしない)/ 2 = 引数の誤り・正本が読めない・区画の印が壊れている。
// 説明: scripts/workflow/memory/README.md
import { existsSync } from "node:fs";

import { applyHeader, headerState, memoryDir, MemoryError, parseArgs, readHeaderSource, repoTop, runAction } from "./lib.mjs";

runAction(() => {
  const { dir: dirFlag, apply } = parseArgs(process.argv.slice(2), { allowApply: true });
  const cwd = process.cwd();
  const dir = memoryDir({ cwd, dirFlag });
  console.log(`dir: ${dir}`);
  if (!existsSync(dir)) {
    console.log("none");
    return;
  }
  const source = readHeaderSource(repoTop(cwd));
  const now = headerState(dir, source);
  console.log(`header: ${now.state}`);
  if (now.state === "broken") throw new MemoryError("区画の印が壊れています(片方だけか 2 つ以上)。手で直してから走らせてください");
  if (now.state === "ok") return;
  if (!apply) {
    for (const l of (now.current ?? "").split("\n").filter(Boolean)) console.log(`- ${l}`);
    for (const l of source.split("\n")) console.log(`+ ${l}`);
    console.log("--apply で区画を正本に戻します");
    return;
  }
  console.log(applyHeader(dir, source) ? "wrote: 区画を正本に戻しました" : "wrote: なし(同じ)");
});
