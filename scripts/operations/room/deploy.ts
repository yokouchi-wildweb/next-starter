// scripts/operations/room/deploy.ts
//
// ルームサーバーのデプロイ (pnpm ops room deploy)。
// 冪等分岐: どのフォークで実行しても正しい結果に落ちる。
//   - config enabled=false          → skip (正常終了。使わないフォークで実行しても無害)
//   - enabled=true, wrangler.toml 無 → 明示エラー (pnpm ops room init を案内)
//   - Worker 名が既定 "room-server"  → 明示エラー (--allow-default-name で強行可)
//   - enabled=true, 準備済み         → wrangler deploy (認証エラーは wrangler が明示する)
// 本番ならセーフポイントの上でだけ出す(違えば止める。--allow-unsafe=<理由> で通す。scripts/runner/guard/README.md)

import { guardDeploy } from "../../runner/guard";
import { guardSafePoint, takeAllowUnsafe } from "../deploy/lib";
import { deployRoomWorker, roomDeployReady } from "./lib.deploy";

console.log("=== realtime room: deploy ===\n");
const allowUnsafe = takeAllowUnsafe();
if (roomDeployReady()) {
  // 本番の Worker に出す前の確認(共通の守り。非対話は方針と人の 1 回分の許可 dep)
  guardDeploy("pnpm ops room deploy(ルームの Worker を本番に出す)", true);
  guardSafePoint(true, allowUnsafe);
  deployRoomWorker(process.argv.slice(2));
}
