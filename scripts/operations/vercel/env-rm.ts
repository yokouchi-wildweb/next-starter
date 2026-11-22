// scripts/operations/vercel/env-rm.ts — pnpm ops vercel env-rm <名前> <production|preview|development>
// 書く動作: 方針 agent.env_production と人の /allow evp の 1 回分の許可(lib.vercel.mjs の前半)→ 共通の守り guardDeploy → vercel。
// 向き先が本番なら evp の許可を本番の確認として守りに渡す(D412)。本体と説明: lib.vercel.mjs・README.md

import { guardDeploy } from "../../runner/guard";
import { executeVercel, prepareVercel } from "./lib.vercel.mjs";

async function main(): Promise<number> {
  const r = await prepareVercel("env-rm", process.argv.slice(2));
  const { prepared } = r;
  if (!prepared) return r.code ?? 1;
  // 本番の確認 = 使う evp の許可(人の 1 回分の言葉)。dep の許可で pnpm live -- --confirm=production が通るのと同じ型
  if (prepared.production && prepared.permitted) process.argv.push("--confirm=production");
  guardDeploy("pnpm ops vercel env-rm(Vercel の env を消す)", prepared.production);
  return executeVercel(prepared);
}

void main().then((code) => {
  process.exitCode = code;
});
