// scripts/workflow/repo-json/show.mjs — pnpm workflow repo-json show
// repo.json の中身と、読み手(forkIds.mjs)の読んだ名前・段・下流の有無・誤りを出す。何も書かない。
// 終了コード: 0 = 読めた / 2 = 誤りがある。説明: scripts/workflow/repo-json/README.md
import { readForkIdentity } from "../../../src/lib/forkOwnership/forkIds.mjs";
import { readValues, runAction } from "./lib.mjs";

runAction(() => {
  const root = process.cwd();
  const values = readValues(root);
  for (const [k, v] of Object.entries(values)) console.log(`${k} = ${JSON.stringify(v)}`);
  const id = readForkIdentity(root);
  console.log(`読み手: repo_id=${id.own ?? "-"} tier=${id.tier} downstream=${id.downstream ?? "-"} Tier1=${id.isTier1 ? "yes" : "no"}`);
  const problems = [...id.errors, ...(id.downstreamError ? [id.downstreamError] : [])];
  for (const p of problems) console.log(`誤り: ${p}`);
  if (problems.length) process.exitCode = 2;
});
