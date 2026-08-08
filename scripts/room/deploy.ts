// scripts/room/deploy.ts
//
// ルームサーバーのデプロイ (pnpm room:deploy)。
// 冪等分岐: どのフォークで実行しても正しい結果に落ちる。
//   - config enabled=false          → skip (正常終了。使わないフォークで実行しても無害)
//   - enabled=true, wrangler.toml 無 → 明示エラー (pnpm room:init を案内)
//   - enabled=true, 準備済み         → wrangler deploy (認証エラーは wrangler が明示する)

import { execSync } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";

import { REALTIME_ROOM_CONFIG } from "../../src/config/app/realtime-room.config";

const repoRoot = path.resolve(import.meta.dirname, "../..");
const roomDir = path.join(repoRoot, "servers/room");

console.log("=== realtime room: deploy ===\n");

if (!REALTIME_ROOM_CONFIG.enabled) {
  console.log("room: skipped (realtime-room.config enabled=false)");
  console.log("有効化するには pnpm room:init を実行し、README の手順に従ってください");
  process.exit(0);
}

if (!existsSync(path.join(roomDir, "wrangler.toml"))) {
  console.error("✗ servers/room/wrangler.toml がありません。先に pnpm room:init を実行してください");
  process.exit(1);
}

if (!existsSync(path.join(roomDir, "node_modules"))) {
  console.log("→ servers/room の依存をインストールします...");
  execSync("pnpm install --ignore-workspace", { cwd: roomDir, stdio: "inherit" });
}

console.log("→ wrangler deploy を実行します...\n");
execSync("pnpm exec wrangler deploy", { cwd: roomDir, stdio: "inherit" });
console.log("\n✓ デプロイ完了");
