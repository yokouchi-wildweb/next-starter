// scripts/operations/deploy/app.ts
//
// アプリだけのデプロイ (pnpm live = pnpm live:app)。Vercel に出す。ルームサーバーには触れない
// (ルームサーバーも = pnpm live:all、ルームサーバーだけ = pnpm live:room)。
//
// 事前検査: pnpm check cron（食い違えばデプロイせず止まる）
// 引数はそのまま vercel CLI へ渡す。無指定なら --prod。
//   pnpm live                          # vercel --prod
//   pnpm live -- --target=preview      # プレビュー(vercel CLI に --preview は無い)
// ※ ルームサーバーのプロトコルを変えた変更は pnpm live:all で出す(Worker → アプリの順で揃える)

import { guardDeploy } from "../../runner/guard";
import { argsOf, checkCron, deployApp, isProductionVercel } from "./lib";

console.log("=== live:app (app) ===\n");
// 本番に出すなら確認(非対話は --confirm=production が要る)。何かを打つ前に止める
guardDeploy("pnpm live(アプリを本番に出す)", isProductionVercel(argsOf(process.argv.slice(2)).filter((a) => !a.startsWith("--confirm="))));
checkCron();
deployApp(argsOf(process.argv.slice(2)));
console.log("\n✓ デプロイ完了 (app)");
