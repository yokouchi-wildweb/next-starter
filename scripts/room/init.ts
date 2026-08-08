// scripts/room/init.ts
//
// リアルタイムルーム基盤の有効化セットアップ (pnpm room:init)。
// 冪等: 何度実行しても安全 (既存の wrangler.toml は上書きしない)。
//
// やること:
//   1. servers/room/wrangler.toml.example → wrangler.toml のコピー (未存在時のみ)
//   2. servers/room の依存インストール
//   3. 残りの手動ステップ (env / secret / config) のチェックリスト表示

import { execSync } from "node:child_process";
import { copyFileSync, existsSync } from "node:fs";
import path from "node:path";

const repoRoot = path.resolve(import.meta.dirname, "../..");
const roomDir = path.join(repoRoot, "servers/room");
const tomlExample = path.join(roomDir, "wrangler.toml.example");
const toml = path.join(roomDir, "wrangler.toml");

console.log("=== realtime room: init ===\n");

// 1. wrangler.toml
if (existsSync(toml)) {
  console.log("✓ servers/room/wrangler.toml は既に存在します (上書きしません)");
} else {
  copyFileSync(tomlExample, toml);
  console.log("✓ servers/room/wrangler.toml を作成しました (wrangler.toml.example からコピー)");
}

// 2. 依存インストール (servers/room は pnpm workspace 外の独立パッケージ)
console.log("\n→ servers/room の依存をインストールします...");
// --ignore-workspace: servers/room は root pnpm workspace に参加しない独立パッケージ
execSync("pnpm install --ignore-workspace", { cwd: roomDir, stdio: "inherit" });
console.log("✓ 依存インストール完了");

// 3. チェックリスト
console.log(`
=== 残りの手動ステップ ===

1. 共有署名鍵を生成する (例: openssl rand -base64 32)

2. Next 側 env (.env.production / Vercel) に設定:
     REALTIME_ROOM_URL=            # 初回デプロイ後に発行される Worker URL
     REALTIME_ROOM_AUTH_SECRET=    # 1. で生成した値

3. Worker 側 secret に同じ値を登録:
     pnpm -C servers/room exec wrangler secret put REALTIME_ROOM_AUTH_SECRET

4. servers/room/wrangler.toml の [vars] APP_BASE_URL にアプリの正式オリジンを設定
   (callback effect = PG 永続化エスケープハッチを使う場合のみ)

5. src/config/app/realtime-room.config.ts の enabled を true にする

6. デプロイ:
     pnpm room:deploy               # ローカルから (要 wrangler login または CLOUDFLARE_API_TOKEN)
   または CI 経由 (git push で自動):
     cp .github/workflows/deploy-room.yml.example .github/workflows/deploy-room.yml
     GitHub Secrets に CLOUDFLARE_API_TOKEN / CLOUDFLARE_ACCOUNT_ID を登録

ローカル動作確認 (Cloudflare アカウント不要):
     pnpm room:dev                  # wrangler dev でローカル起動

詳細: servers/room/README.md
`);
