// scripts/deploy.ts
//
// 統合デプロイ (pnpm deploy:all)。手動デプロイ運用の標準コマンド。
// アプリ (Vercel) とルームサーバー (Cloudflare Workers) を 1 コマンドで揃えてデプロイする。
//
// 順序: Worker → アプリ。
//   アプリ側はプロトコル不一致を明示エラーにするため (ROOM_PROTOCOL_VERSION)、
//   先に Worker を最新化してからアプリを出すことでスキュー窓を最小にする。
//
// 冪等分岐 (room 部分は scripts/room/deploy.ts と同一):
//   - realtime-room.config enabled=false → Worker は skip してアプリのみデプロイ
//     (使わないフォークでもこのコマンド 1 つで従来通り運用できる)
//   - enabled=true で未初期化 → 明示エラー (アプリのデプロイにも進まない)
//
// 引数はそのまま vercel CLI へ渡す。無指定なら --prod。
//   pnpm deploy:all               # vercel --prod
//   pnpm deploy:all -- --preview  # プレビューデプロイ等、任意の vercel 引数

import { execSync, spawnSync } from "node:child_process";
import path from "node:path";

const repoRoot = path.resolve(import.meta.dirname, "..");

console.log("=== deploy:all (room → app) ===\n");

// --- 1. Worker (servers/room) ---
// skip (enabled=false) は exit 0 で返るため、そのままアプリへ進む
try {
  execSync("pnpm room:deploy", { cwd: repoRoot, stdio: "inherit" });
} catch {
  console.error("\n✗ ルームサーバーのデプロイに失敗したため、アプリのデプロイを中止します");
  process.exit(1);
}

// --- 2. アプリ (Vercel) ---
const versionCheck = spawnSync("vercel", ["--version"], { shell: false });
if (versionCheck.error || versionCheck.status !== 0) {
  console.error(`
✗ vercel CLI が見つかりません。インストールしてください:
    npm i -g vercel
  初回はプロジェクトのリンクが必要です:
    vercel link
`);
  process.exit(1);
}

const vercelArgs = process.argv.slice(2);
const args = vercelArgs.length > 0 ? vercelArgs : ["--prod"];

console.log(`\n→ vercel ${args.join(" ")} を実行します...\n`);
const result = spawnSync("vercel", args, { cwd: repoRoot, stdio: "inherit", shell: false });
if (result.status !== 0) {
  console.error("\n✗ アプリのデプロイに失敗しました");
  process.exit(result.status ?? 1);
}

console.log("\n✓ デプロイ完了 (room + app)");
