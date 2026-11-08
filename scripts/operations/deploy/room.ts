// scripts/operations/deploy/room.ts
//
// ルームサーバーだけのデプロイ (pnpm live:room)。中身は pnpm ops room deploy(enabled=false なら skip)。
// アプリには触れない(アプリも = pnpm live:all、アプリだけ = pnpm live)。
//
// 事前検査: pnpm check cron（どのデプロイも同じ検査を先に通す）
// 引数は pnpm ops room deploy へ渡す。
//   pnpm live:room
//   pnpm live:room -- --allow-default-name

import { guardDeploy } from "../../runner/guard";
import { argsOf, checkCron, deployRoom, roomWillDeploy } from "./lib";

console.log("=== live:room (room) ===\n");
// Worker を出すなら確認(非対話は --confirm=production が要る)。何かを打つ前に止める
guardDeploy("pnpm live:room(ルームの Worker を本番に出す)", roomWillDeploy());
checkCron();
deployRoom([...argsOf(process.argv.slice(2)), ...(roomWillDeploy() ? ["--confirm=production"] : [])]);
