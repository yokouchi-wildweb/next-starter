// scripts/operations/deploy/all.ts
//
// 全部のデプロイ (pnpm live:all)。アプリ (Vercel) とルームサーバー (Cloudflare Workers) を 1 コマンドで揃えて出す。
// アプリだけ = pnpm live(= pnpm live:app、scripts/operations/deploy/app.ts)| ルームサーバーだけ = pnpm live:room(room.ts)
//
// 事前検査: pnpm check cron（vercel.json の crons が src/app/api/cron/*/task.ts と食い違えば何もデプロイせず止まる）
//
// 順序: Worker → アプリ。
//   アプリ側はプロトコル不一致を明示エラーにするため (ROOM_PROTOCOL_VERSION)、
//   先に Worker を最新化してからアプリを出すことでスキュー窓を最小にする。
//
// 冪等分岐 (room 部分は scripts/operations/room/deploy.ts と同一):
//   - realtime-room.config enabled=false → Worker は skip してアプリのみデプロイ
//     (使わないフォークでもこのコマンド 1 つで従来通り運用できる)
//   - enabled=true で未初期化 → 明示エラー (アプリのデプロイにも進まない)
//
// 引数はそのまま vercel CLI へ渡す。無指定なら --prod。
//   pnpm live:all                        # vercel --prod
//   pnpm live:all -- --target=preview    # プレビューデプロイ等、任意の vercel 引数
// ※ vercel CLI に --preview フラグは存在しない。素のデプロイ (=プレビュー) は本コマンドでは
//    --prod フォールバックに塞がれているため、プレビューは --target=preview を明示すること

import { guardDeploy } from "../../runner/guard";
import { argsOf, checkCron, deployApp, deployRoom, isProductionVercel, roomWillDeploy } from "./lib";

console.log("=== live:all (room → app) ===\n");
// 本番に出すなら(アプリが --prod か、ルームの Worker を出すなら)確認を 1 回。非対話は --confirm=production が要る。何かを打つ前に止める
const production = roomWillDeploy() || isProductionVercel(argsOf(process.argv.slice(2)).filter((a) => !a.startsWith("--confirm=")));
guardDeploy("pnpm live:all(ルームとアプリを本番に出す)", production);
checkCron();
// 確認は済んだので、子の pnpm ops room deploy には --confirm=production を渡す(二度聞かない)
deployRoom(roomWillDeploy() ? ["--confirm=production"] : []);
deployApp(argsOf(process.argv.slice(2)));
console.log("\n✓ デプロイ完了 (room + app)");
