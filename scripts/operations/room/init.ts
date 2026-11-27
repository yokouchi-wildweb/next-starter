// scripts/operations/room/init.ts
//
// リアルタイムルーム基盤の有効化セットアップ (pnpm ops room init)。
// 冪等: 何度実行しても安全 (既存の wrangler.toml は上書きしない)。
//
// やること:
//   1. servers/room/wrangler.toml.example → wrangler.toml のコピー (未存在時のみ)。
//      name は Worker の名前 room-server-<repo_id> (workerName.mjs、deploy・secret が --name で渡すのと同じ。
//      wrangler.toml の name は deploy・secret では使わない: 下の段へ受け継がれても親の Worker を置き換えない。D490)
//   2. servers/room の依存インストール
//   3. 残りの手動ステップ (env / secret / config) のチェックリスト表示

import { execSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

import { roomWorkerName } from "./workerName.mjs";

const repoRoot = path.resolve(import.meta.dirname, "../../..");
const roomDir = path.join(repoRoot, "servers/room");
const tomlExample = path.join(roomDir, "wrangler.toml.example");
const toml = path.join(roomDir, "wrangler.toml");

console.log("=== realtime room: init ===\n");

// 1. wrangler.toml
const worker = roomWorkerName(repoRoot);
if (worker.error !== undefined) {
  console.error(`✗ ${worker.error}`);
  process.exit(1);
}
if (existsSync(toml)) {
  console.log("✓ servers/room/wrangler.toml は既に存在します (上書きしません)");
} else {
  writeFileSync(toml, readFileSync(tomlExample, "utf8").replace(/^name\s*=\s*"room-server"/m, `name = "${worker.name}"`));
  console.log("✓ servers/room/wrangler.toml を作成しました");
}
console.log(`  Worker の名前: ${worker.name} (repo.json の repo_id から。deploy・secret はこの名前で出す)`);

// 2. 依存インストール (servers/room は pnpm workspace 外の独立パッケージ)
console.log("\n→ servers/room の依存をインストールします...");
// --ignore-workspace: servers/room は root pnpm workspace に参加しない独立パッケージ
execSync("pnpm install --ignore-workspace", { cwd: roomDir, stdio: "inherit" });
console.log("✓ 依存インストール完了");

// 3. チェックリスト
console.log(`
=== 残りの手動ステップ ===

1. Worker の名前は ${worker.name} (repo.json の repo_id から。deploy・secret が --name で渡す):
   同じ Cloudflare アカウントに同じ repo_id の別のリポを置かないこと (wrangler deploy は同じ名前の Worker を黙って置き換える)

2. workers.dev サブドメインを登録する (アカウントごとに1回だけ):
     Cloudflare ダッシュボード → Workers & Pages → 右カラム「workers.dev サブドメイン」
   → この時点で Worker URL が機械的に確定する:
     https://<Worker名>.<サブドメイン>.workers.dev
   ※ 初回デプロイの対話プロンプトに任せない (CI では対話できず失敗する)

3. Next 側 env (.env.production / Vercel) に設定:
     REALTIME_ROOM_URL=            # 2. で確定した Worker URL (公開情報なので通常の env でよい)

4. servers/room/wrangler.toml の [vars] APP_BASE_URL にアプリの正式オリジンを設定
   (callback effect = PG 永続化エスケープハッチを使う場合のみ)

5. src/config/lib/realtimeRoom.config.ts に enabled: true を書く

6. デプロイ:
     pnpm live:all                # アプリ + Worker の統合デプロイ (手動運用の標準)
     pnpm ops room deploy               # Worker 単体 (要 wrangler login または CLOUDFLARE_API_TOKEN)
   CI 経由 (git push 連動) を使うフォークのみ:
     cp .github/workflows/deploy-room.yml.example .github/workflows/deploy-room.yml
     GitHub Secrets に CLOUDFLARE_API_TOKEN / CLOUDFLARE_ACCOUNT_ID を登録

7. 共有鍵の生成と Worker への登録 (※ 必ず初回デプロイの後に):
     pnpm ops room secret               # 生成 + 非対話登録 + Next 側 env に貼る行を表示
   表示された REALTIME_ROOM_AUTH_SECRET を Next 側 env に貼る (Vercel は Sensitive 推奨)。
   secret は以後のデプロイでも保持される。ローテーションは pnpm ops room secret --rotate

8. 動作確認:
     pnpm ops room check                # 疎通〜認可〜WS配信〜永続化の11項目を機械検証
   (初回は workers.dev 伝播待ちで最大60秒リトライ。最低限なら: curl https://<Worker URL>/version)

ローカル動作確認 (Cloudflare アカウント不要):
     pnpm ops room dev                  # wrangler dev でローカル起動

詳細: servers/room/README.md
`);
