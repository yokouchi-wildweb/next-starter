// scripts/structure/cron/gate-generate.ts — 門の入口(pnpm generate cron -- --plan hobby|pro): vercel.json の crons を task.ts から作り直す(generate.ts)
// プラン(契約)は人が選ぶので、--plan の無い呼び出し(pnpm generate の全部の対象を回す時を含む)は書かずに飛ばして出す
if (process.argv.slice(2).some((a) => a === "--plan" || a.startsWith("--plan="))) void import("./generate");
else console.log("[cron] 契約のプランを選ぶので飛ばした(作り直す: pnpm generate cron -- --plan hobby|pro)");
