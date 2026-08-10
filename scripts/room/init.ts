// scripts/room/init.ts
//
// リアルタイムルーム基盤の有効化セットアップ (pnpm room:init)。
// 冪等: 何度実行しても安全 (既存の wrangler.toml は上書きしない)。
//
// やること:
//   1. servers/room/wrangler.toml.example → wrangler.toml のコピー (未存在時のみ)。
//      Worker 名はプロジェクト固有名 "room-server-<package名>" に書き換える。
//      既定名 "room-server" のままだと、同一 Cloudflare アカウントに複数プロジェクトが
//      同居した場合に wrangler deploy が同名 Worker を無言で置換する事故が起きるため
//      (deploy 側にも既定名ガードあり)
//   2. servers/room の依存インストール
//   3. 残りの手動ステップ (env / secret / config) のチェックリスト表示

import { execSync } from "node:child_process";
import { copyFileSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const repoRoot = path.resolve(import.meta.dirname, "../..");
const roomDir = path.join(repoRoot, "servers/room");
const tomlExample = path.join(roomDir, "wrangler.toml.example");
const toml = path.join(roomDir, "wrangler.toml");

/** root package.json の name から Worker 名を導出する (Cloudflare 制約: 小文字英数とハイフン) */
const deriveWorkerName = (): { name: string; fromTemplateDefault: boolean } => {
  const pkg = JSON.parse(readFileSync(path.join(repoRoot, "package.json"), "utf8")) as { name?: string };
  const raw = (pkg.name ?? "app").toLowerCase();
  const sanitized = raw.replace(/[^a-z0-9-]+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");
  return {
    name: `room-server-${sanitized}`.slice(0, 63).replace(/-$/, ""),
    // テンプレート既定の package 名のままだと、同様に未リネームの別フォークと導出名が再衝突し得る
    fromTemplateDefault: raw === "nextjs-app-template",
  };
};

console.log("=== realtime room: init ===\n");

// 1. wrangler.toml
const derived = deriveWorkerName();
if (existsSync(toml)) {
  console.log("✓ servers/room/wrangler.toml は既に存在します (上書きしません)");
  const currentName = /^name\s*=\s*"([^"]+)"/m.exec(readFileSync(toml, "utf8"))?.[1];
  if (currentName === "room-server") {
    console.warn(`⚠ Worker 名が既定の "room-server" のままです。同一アカウント同居時に他プロジェクトの
  Worker を無言で上書きする危険があるため、wrangler.toml の name をプロジェクト固有名
  (例: "${derived.name}") に変更してください (room:deploy は既定名を拒否します)`);
  }
} else {
  const content = readFileSync(tomlExample, "utf8").replace(/^name\s*=\s*"room-server"/m, `name = "${derived.name}"`);
  writeFileSync(toml, content);
  console.log(`✓ servers/room/wrangler.toml を作成しました (Worker 名: "${derived.name}")`);
  if (derived.fromTemplateDefault) {
    console.warn(`⚠ package.json の name がテンプレート既定のままのため、導出した Worker 名も他の未リネーム
  フォークと衝突し得ます。package.json name をプロジェクト名に変えて再実行するか、
  wrangler.toml の name を直接固有名に編集してください`);
  }
}

// 2. 依存インストール (servers/room は pnpm workspace 外の独立パッケージ)
console.log("\n→ servers/room の依存をインストールします...");
// --ignore-workspace: servers/room は root pnpm workspace に参加しない独立パッケージ
execSync("pnpm install --ignore-workspace", { cwd: roomDir, stdio: "inherit" });
console.log("✓ 依存インストール完了");

// 3. チェックリスト
console.log(`
=== 残りの手動ステップ ===

1. Worker 名を確認する (上記で wrangler.toml に書き込み済み):
   同一 Cloudflare アカウントに複数プロジェクトが同居する場合、wrangler deploy は
   同名 Worker を無言で置換するため、名前の一意性は必ず確認すること
   (既定名 "room-server" のままのデプロイは room:deploy が拒否する)

2. workers.dev サブドメインを登録する (アカウントごとに1回だけ):
     Cloudflare ダッシュボード → Workers & Pages → 右カラム「workers.dev サブドメイン」
   → この時点で Worker URL が機械的に確定する:
     https://<Worker名>.<サブドメイン>.workers.dev
   ※ 初回デプロイの対話プロンプトに任せない (CI では対話できず失敗する)

3. Next 側 env (.env.production / Vercel) に設定:
     REALTIME_ROOM_URL=            # 2. で確定した Worker URL (公開情報なので通常の env でよい)

4. servers/room/wrangler.toml の [vars] APP_BASE_URL にアプリの正式オリジンを設定
   (callback effect = PG 永続化エスケープハッチを使う場合のみ)

5. src/config/app/realtime-room.config.ts の enabled を true にする

6. デプロイ:
     pnpm deploy:all                # アプリ + Worker の統合デプロイ (手動運用の標準)
     pnpm room:deploy               # Worker 単体 (要 wrangler login または CLOUDFLARE_API_TOKEN)
   CI 経由 (git push 連動) を使うフォークのみ:
     cp .github/workflows/deploy-room.yml.example .github/workflows/deploy-room.yml
     GitHub Secrets に CLOUDFLARE_API_TOKEN / CLOUDFLARE_ACCOUNT_ID を登録

7. 共有鍵の生成と Worker への登録 (※ 必ず初回デプロイの後に):
     pnpm room:secret               # 生成 + 非対話登録 + Next 側 env に貼る行を表示
   表示された REALTIME_ROOM_AUTH_SECRET を Next 側 env に貼る (Vercel は Sensitive 推奨)。
   secret は以後のデプロイでも保持される。ローテーションは pnpm room:secret --rotate

8. 動作確認:
     pnpm room:check                # 疎通〜認可〜WS配信〜永続化の11項目を機械検証
   (初回は workers.dev 伝播待ちで最大60秒リトライ。最低限なら: curl https://<Worker URL>/version)

ローカル動作確認 (Cloudflare アカウント不要):
     pnpm room:dev                  # wrangler dev でローカル起動

詳細: servers/room/README.md
`);
