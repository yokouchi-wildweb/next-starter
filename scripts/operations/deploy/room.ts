// scripts/operations/deploy/room.ts
//
// ルームサーバーだけのデプロイ (pnpm live:room)。中身は pnpm ops room deploy(enabled=false なら skip)。
// アプリには触れない(アプリも = pnpm live:all、アプリだけ = pnpm live)。
//
// 事前検査: pnpm check cron（どのデプロイも同じ検査を先に通す）
// 引数は pnpm ops room deploy へ渡す。
//   pnpm live:room
//   pnpm live:room -- --allow-default-name

import { argsOf, checkCron, deployRoom } from "./lib";

console.log("=== live:room (room) ===\n");
checkCron();
deployRoom(argsOf(process.argv.slice(2)));
