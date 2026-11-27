// scripts/operations/room/deploy.ts
//
// ルームサーバーのデプロイ (pnpm ops room deploy)。
// 冪等分岐: どのフォークで実行しても正しい結果に落ちる。
//   - config enabled=false          → skip (正常終了。使わないフォークで実行しても無害)
//   - enabled=true, wrangler.toml 無 → 明示エラー (pnpm ops room init を案内)
//   - enabled=true, 準備済み         → wrangler deploy --name room-server-<repo_id> (認証エラーは wrangler が明示する)
// 本番なら今セーフポイントの上かを 1 行出す(止めない、D317。scripts/runner/guard/README.md)

import { guardDeploy } from "../../runner/guard";
import { reportSafePoint } from "../deploy/lib";
import { deployRoomWorker, roomDeployReady } from "./lib.deploy";

console.log("=== realtime room: deploy ===\n");
if (roomDeployReady()) {
  // 本番の Worker に出す前の確認(共通の守り。非対話は方針と人の 1 回分の許可 dep)
  guardDeploy("pnpm ops room deploy(ルームの Worker を本番に出す)", true);
  reportSafePoint(true);
  deployRoomWorker();
}
