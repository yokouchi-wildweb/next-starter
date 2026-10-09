// scripts/env/init.ts
//
// ローカル用 .env ファイルの初期生成 (pnpm env:init [ファイル名])。
// 冪等: 対象ファイルが既に存在すれば何もせず終了する (上書きしない)。
//
// やること:
//   1. .env.example → .env.development (引数で変更可) のコピー
//   2. 最小構成で dev サーバーを起動するのに必要な値を埋める
//      - APP_BASE_URL     = http://localhost:3000
//      - AUTH_JWT_SECRET  = ランダム 32 バイト (base64)
//      - ENCRYPTION_KEY   = ランダム 32 バイト (hex 64 文字)
//      .env.example 側で既に値が入っている行は触らない (空の行だけ埋める)
//   3. 残りの任意設定 (Firebase / DB 等) のチェックリスト表示
//
// 生成した秘密値は表示しない (ターミナルログに残さないため)。

import { randomBytes } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const repoRoot = path.resolve(import.meta.dirname, "../..");
const examplePath = path.join(repoRoot, ".env.example");

const targetName = process.argv[2] ?? ".env.development";
if (!/^\.env(\..+)?$/.test(targetName) || targetName === ".env.example") {
  console.error(`✗ 対象ファイル名は .env または .env.<name> の形式で指定してください: ${targetName}`);
  process.exit(1);
}
const targetPath = path.join(repoRoot, targetName);

/** 空の行にだけ値を入れる。キーが無ければ末尾に追記する */
const fillIfEmpty = (lines: string[], key: string, value: string): "filled" | "kept" | "appended" => {
  const pattern = new RegExp(`^${key}=(.*)$`);
  for (let i = 0; i < lines.length; i++) {
    const match = lines[i].match(pattern);
    if (!match) continue;
    const current = match[1].trim().replace(/^['"]|['"]$/g, "");
    if (current.length > 0) return "kept";
    lines[i] = `${key}=${value}`;
    return "filled";
  }
  lines.push(`${key}=${value}`);
  return "appended";
};

console.log("=== env: init ===\n");

if (!existsSync(examplePath)) {
  console.error("✗ .env.example が見つかりません");
  process.exit(1);
}

if (existsSync(targetPath)) {
  console.log(`✓ ${targetName} は既に存在するため何もしません (再生成する場合は削除してから実行)`);
  process.exit(0);
}

const lines = readFileSync(examplePath, "utf8").split("\n");

const results = {
  APP_BASE_URL: fillIfEmpty(lines, "APP_BASE_URL", "http://localhost:3000"),
  AUTH_JWT_SECRET: fillIfEmpty(lines, "AUTH_JWT_SECRET", randomBytes(32).toString("base64")),
  ENCRYPTION_KEY: fillIfEmpty(lines, "ENCRYPTION_KEY", randomBytes(32).toString("hex")),
};

writeFileSync(targetPath, lines.join("\n"), { mode: 0o600 });

console.log(`✓ ${targetName} を作成しました\n`);
for (const [key, result] of Object.entries(results)) {
  const label = result === "kept" ? ".env.example の値を維持" : result === "appended" ? "末尾に追記" : "生成値を設定";
  console.log(`  ${key.padEnd(16)} ${label}`);
}

console.log(`
この状態で pnpm dev が起動します (Firebase / DB 未接続)。
必要になったら以下を設定してください:
  - DATABASE_URL                 Neon 等の接続文字列 → pnpm db:push
  - NEXT_PUBLIC_FIREBASE_*       Firebase Auth / Storage / Firestore
  - MY_SERVICE_ACCOUNT_KEY       Firebase Admin SDK
手順: docs/how-to/initial-setup/Neon_Firebaseなど各種バックエンドサービスの設定方法.md
`);
