// scripts/room/secret.ts
//
// 共有署名鍵の生成と Worker への非対話登録 (pnpm room:secret)。
// 手動フロー (生成 → env 貼り付け → 対話 wrangler secret put) に残っていた 3 つの罠を排除する:
//   - デプロイ前の secret put が対話プロンプト (Worker 新規作成確認) に落ちる → 未デプロイなら明示拒否
//   - Worker 側と Next 側 env の同値が未検証 → 同じ値を「登録 + 表示」で一元化
//   - 対話 put は CI / 無人実行できない → `wrangler secret bulk` (一時ファイル経由) で非対話化
//
// 使い方:
//   pnpm room:secret            # 生成 + 登録 + Next 側 env 行の表示。登録済みなら拒否 (誤ローテ防止)
//   pnpm room:secret --rotate   # 新しい鍵で再生成・再登録 (Next 側 env の差し替えを忘れないこと)
//
// 一時ファイルは chmod 600 で作成し、成否に関わらず即削除する (シェル履歴にも鍵を残さない)。

import { randomBytes } from "node:crypto";
import { execSync } from "node:child_process";
import { existsSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";

const repoRoot = path.resolve(import.meta.dirname, "../..");
const roomDir = path.join(repoRoot, "servers/room");
const wranglerBin = path.join(roomDir, "node_modules/.bin/wrangler");
const SECRET_NAME = "REALTIME_ROOM_AUTH_SECRET";
const rotate = process.argv.includes("--rotate");

console.log("=== realtime room: secret ===\n");

if (!existsSync(path.join(roomDir, "wrangler.toml"))) {
  console.error("✗ servers/room/wrangler.toml がありません。先に pnpm room:init を実行してください");
  process.exit(1);
}
if (!existsSync(wranglerBin)) {
  console.error("✗ servers/room の依存が未インストールです。先に pnpm room:init を実行してください");
  process.exit(1);
}

// 認証プリフライト (room:deploy と同方式。whoami は未認証でも exit 0 のため出力文字列で判定)
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

// デプロイ済みプリフライト: 未デプロイ Worker への secret 登録は対話プロンプト (新規作成確認) に
// 落ちるため、secret list の失敗をもって明示拒否する (「デプロイが先」ルールのツール化)
let secretListOut = "";
try {
  secretListOut = execSync(`${wranglerBin} secret list`, { cwd: roomDir, stdio: "pipe" }).toString();
} catch (error) {
  const detail = error instanceof Error && "stderr" in error ? String((error as { stderr?: unknown }).stderr ?? "") : "";
  console.error(`✗ Worker の secret 一覧を取得できません。Worker が未デプロイの可能性が高いです。
  先に pnpm room:deploy で初回デプロイしてから再実行してください。
${detail ? `  wrangler の出力: ${detail.trim().split("\n").slice(-3).join(" / ")}` : ""}`);
  process.exit(1);
}

const alreadyRegistered = secretListOut.includes(SECRET_NAME);
if (alreadyRegistered && !rotate) {
  console.error(`✗ ${SECRET_NAME} は既に Worker へ登録済みです。
  誤って鍵を差し替えると Next 側 env と食い違い、全接続が認証エラーになります。
  意図的にローテーションする場合: pnpm room:secret --rotate (Next 側 env の差し替えとセットで)`);
  process.exit(1);
}

// 生成 → 一時ファイル (chmod 600) → wrangler secret bulk → 即削除
const secretValue = randomBytes(32).toString("base64");
const tmpFile = path.join(roomDir, ".room-secret.tmp.json");
try {
  writeFileSync(tmpFile, JSON.stringify({ [SECRET_NAME]: secretValue }), { mode: 0o600 });
  execSync(`${wranglerBin} secret bulk ${JSON.stringify(tmpFile)}`, { cwd: roomDir, stdio: "pipe" });
} catch {
  console.error("✗ wrangler secret bulk が失敗しました。認証・Worker 名 (wrangler.toml) を確認してください");
  process.exit(1);
} finally {
  rmSync(tmpFile, { force: true });
}

console.log(`✓ Worker へ ${SECRET_NAME} を登録しました${rotate && alreadyRegistered ? " (ローテーション)" : ""}

=== Next 側 env に貼り付け (.env.production / Vercel。SECRET は Sensitive 指定を推奨) ===

REALTIME_ROOM_AUTH_SECRET=${secretValue}

(REALTIME_ROOM_URL は変更不要${rotate ? "" : "。未設定なら Worker URL を設定すること"})
${rotate ? "\n⚠ ローテーション実行済み: Next 側 env を上の値に差し替えるまで、全接続が認証エラーになります" : ""}`);
