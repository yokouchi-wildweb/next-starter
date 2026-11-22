// scripts/operations/vercel/env-pull.ts — pnpm ops vercel env-pull <production|preview|development> <書く先>
// 書く動作: 方針 agent.env_production と人の /allow evp の 1 回分の許可(lib.vercel.mjs の前半)→ 共通の守り guardDeploy → vercel。
// 向き先が本番なら守りが種類 env_production の方針と evp の許可で通し、許可を消す(D412・D420)。本体と説明: lib.vercel.mjs・README.md

import { guardDeploy } from "../../runner/guard";
import { executeVercel, prepareVercel } from "./lib.vercel.mjs";

async function main(): Promise<number> {
  const r = await prepareVercel("env-pull", process.argv.slice(2));
  const { prepared } = r;
  if (!prepared) return r.code ?? 1;
  guardDeploy("pnpm ops vercel env-pull(Vercel の env をファイルに取る)", prepared.production, "env_production");
  return executeVercel(prepared);
}

void main().then((code) => {
  process.exitCode = code;
});
