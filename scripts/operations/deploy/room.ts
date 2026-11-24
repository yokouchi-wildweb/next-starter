// scripts/operations/deploy/room.ts
//
// ルームサーバーだけのデプロイ (pnpm live:room)。中身は pnpm ops room deploy と同じ本体(room/lib.deploy.ts、enabled=false なら skip)。
// アプリには触れない(アプリも = pnpm live:all、アプリだけ = pnpm live)。
//
// 事前検査: pnpm check cron（どのデプロイも同じ検査を先に通す）
// 引数は本体へ渡す(--allow-default-name)。
//   pnpm live:room
//   pnpm live:room -- --allow-default-name
// 本番なら今セーフポイントの上かを 1 行出す(止めない、D317。scripts/runner/guard/README.md)

import { guardDeploy } from "../../runner/guard";
import { argsOf, checkCron, deployRoom, reportSafePoint, roomWillDeploy } from "./lib";

console.log("=== live:room (room) ===\n");
// Worker を出すなら確認(非対話は方針と人の 1 回分の許可 dep)。何かを打つ前に止める
guardDeploy("pnpm live:room(ルームの Worker を本番に出す)", roomWillDeploy());
reportSafePoint(roomWillDeploy());
checkCron();
deployRoom(argsOf(process.argv.slice(2)));
