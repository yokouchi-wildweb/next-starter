// scripts/structure/cron/phase-generate.ts — 段階の入口(pnpm generate cron [-- --plan hobby|pro]): vercel.json の crons を task.ts から作り直す(generate.ts)
// プラン(契約)は人が選ぶ: --plan か repo.json の vercel.plan(pnpm workflow repo-json set vercel.plan <hobby|pro>)。どちらも無い = Vercel に
// デプロイしないリポなので、書かずに飛ばして出す(pnpm generate の全部の対象を回す時・/flux の区間の作り直しを含む)
import { readVercelPlan } from "@/lib/forkOwnership/node.mjs";

const flagged = process.argv.slice(2).some((a) => a === "--plan" || a.startsWith("--plan="));
const declared = readVercelPlan(process.cwd());
if (flagged || declared.plan !== null || declared.error !== null) void import("./generate");
else console.log("[cron] repo.json に vercel.plan が無いので飛ばした(Vercel にデプロイするリポは pnpm workflow repo-json set vercel.plan <hobby|pro>、1 回だけ: pnpm generate cron -- --plan hobby|pro)");
