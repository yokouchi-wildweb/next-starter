// scripts/operations/setup/env.ts
//
// env ファイルの初期生成 (pnpm ops setup env [ファイル名])。引数なし = .env.development と .env.production の 2 つ(env の規則)。
// 冪等: 対象ファイルが既に存在すれば何もせず終了する (上書きしない)。
//
// やること:
//   1. .env.example → .env.development と .env.production (引数で 1 つに絞れる) のコピー
//   2. 段階の印 APP_ENV をファイル名に合わせて書く (.env.staging* → staging / .env.production* → production / ほか → development。@/lib/appEnv)
//   3. 最小構成で dev サーバーを起動するのに必要な値を埋める
//      - APP_BASE_URL     = http://localhost:3000 (開発だけ。本番は人が書く)
//      - AUTH_JWT_SECRET  = ランダム 32 バイト (base64)
//      - ENCRYPTION_KEY   = ランダム 32 バイト (hex 64 文字)
//      .env.example 側で既に値が入っている行は触らない (空の行だけ埋める)
//   4. 残りの任意設定 (Firebase / DB 等) のチェックリスト表示
//
// 生成した秘密値は表示しない (ターミナルログに残さないため)。

import { existsSync } from "node:fs";
import path from "node:path";

import { createEnvFile, DEFAULT_ENV_FILES, isEnvFileName } from "./lib.env";

const repoRoot = path.resolve(import.meta.dirname, "../../..");

const names = process.argv[2] ? [process.argv[2]] : [...DEFAULT_ENV_FILES];
for (const name of names) {
  if (!isEnvFileName(name)) {
    console.error(`✗ 対象ファイル名は .env または .env.<name> の形式で指定してください: ${name}`);
    process.exit(1);
  }
}

console.log("=== env: init ===\n");

if (!existsSync(path.join(repoRoot, ".env.example"))) {
  console.error("✗ .env.example が見つかりません");
  process.exit(1);
}

for (const name of names) {
  const result = createEnvFile(repoRoot, name);
  if (!result.created) {
    console.log(`✓ ${name} は既に存在するため何もしません (再生成する場合は削除してから実行)`);
    continue;
  }
  console.log(`✓ ${name} を作成しました`);
  console.log(`  ${"APP_ENV".padEnd(16)} ${result.stage} (ファイル名から)`);
  for (const [key, r] of Object.entries(result.results)) {
    const label = r === "kept" ? ".env.example の値を維持" : r === "appended" ? "末尾に追記" : "生成値を設定";
    console.log(`  ${key.padEnd(16)} ${label}`);
  }
  console.log("");
}

console.log(`env の規則: .env.development と .env.production を必ず置き(リリース前でも)、開発と本番は別の DB にする。
書く道具は既定で開発に向き、本番は --env production と確認(scripts/runner/guard/README.md)。
この状態で pnpm dev が起動します (Firebase / DB 未接続)。
必要になったら以下を設定してください:
  - DATABASE_URL                 Neon 等の接続文字列 → pnpm db:push(本番は別の DB / ブランチ)
  - NEXT_PUBLIC_FIREBASE_*       Firebase Auth / Firestore
  - MY_SERVICE_ACCOUNT_KEY       Firebase Admin SDK
  - STORAGE_PUBLIC_BUCKET / STORAGE_PRIVATE_BUCKET
                                 ファイル保存のバケット → pnpm ops storage setup (scripts/operations/storage/README.md)
  - .env.production の APP_BASE_URL と秘密の値(ホスティング側に置くのを推奨)
手順: docs/setup/Neon_Firebaseなど各種バックエンドサービスの設定方法.md
`);
