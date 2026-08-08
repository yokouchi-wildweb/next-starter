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

1. workers.dev サブドメインを登録する (アカウントごとに1回だけ):
     Cloudflare ダッシュボード → Workers & Pages → 右カラム「workers.dev サブドメイン」
   → この時点で Worker URL が機械的に確定する:
     https://room-server.<サブドメイン>.workers.dev
   ※ 初回デプロイの対話プロンプトに任せない (CI では対話できず失敗する)

2. 共有署名鍵を生成する (例: openssl rand -base64 32)

3. Next 側 env (.env.production / Vercel) に設定:
     REALTIME_ROOM_URL=            # 1. で確定した Worker URL (公開情報なので通常の env でよい)
     REALTIME_ROOM_AUTH_SECRET=    # 2. で生成した値 (Vercel では Sensitive 指定を推奨)

4. servers/room/wrangler.toml の [vars] APP_BASE_URL にアプリの正式オリジンを設定
   (callback effect = PG 永続化エスケープハッチを使う場合のみ)

5. src/config/app/realtime-room.config.ts の enabled を true にする

6. デプロイ:
     pnpm deploy:all                # アプリ + Worker の統合デプロイ (手動運用の標準)
     pnpm room:deploy               # Worker 単体 (要 wrangler login または CLOUDFLARE_API_TOKEN)
   CI 経由 (git push 連動) を使うフォークのみ:
     cp .github/workflows/deploy-room.yml.example .github/workflows/deploy-room.yml
     GitHub Secrets に CLOUDFLARE_API_TOKEN / CLOUDFLARE_ACCOUNT_ID を登録

7. Worker 側 secret に 2. と同じ値を登録 (※ 必ず初回デプロイの後に。未デプロイの Worker へ
   secret put すると対話プロンプトが出る。secret は以後のデプロイでも保持される):
     pnpm -C servers/room exec wrangler secret put REALTIME_ROOM_AUTH_SECRET

8. 動作確認:
     pnpm room:check                # 疎通〜認可〜WS配信〜永続化の11項目を機械検証
   (最低限なら: curl https://<Worker URL>/version → {"protocolVersion":N})

ローカル動作確認 (Cloudflare アカウント不要):
     pnpm room:dev                  # wrangler dev でローカル起動

詳細: servers/room/README.md
`);
