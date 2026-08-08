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

// pnpm 経由だと workspace スキャンの警告ノイズが出るため、wrangler は直接バイナリで呼ぶ
const wranglerBin = path.join(roomDir, "node_modules/.bin/wrangler");

// 認証プリフライト: 未認証のまま wrangler deploy に進むと環境によって対話プロンプトで
// ハングするため、先に明示エラーにする (統合コマンド経由の無人実行を安全に失敗させる)。
// 注意: wrangler whoami は未認証でも exit 0 を返すため、出力文字列で判定する
if (!process.env.CLOUDFLARE_API_TOKEN) {
  let whoami = "";
  try {
    whoami = execSync(`${wranglerBin} whoami`, { cwd: roomDir, stdio: "pipe" }).toString();
  } catch {
    whoami = "not authenticated";
  }
  if (/not authenticated/i.test(whoami)) {
    console.error(`✗ Cloudflare 未認証です。どちらかで認証してください:
    pnpm -C servers/room exec wrangler login   # ブラウザで OAuth (手元マシン向け)
    export CLOUDFLARE_API_TOKEN=...            # API トークン (CI / 無人実行向け)`);
    process.exit(1);
  }
}

console.log("→ wrangler deploy を実行します...\n");
try {
  execSync(`${wranglerBin} deploy`, { cwd: roomDir, stdio: "inherit" });
} catch {
  // wrangler が直前に詳細エラーを表示済み。ここではスタックを出さず終了コードのみ返す
  console.error("\n✗ wrangler deploy が失敗しました (上記エラーを参照)");
  process.exit(1);
}
console.log("\n✓ デプロイ完了");
