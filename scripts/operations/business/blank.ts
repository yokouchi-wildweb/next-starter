// scripts/operations/business/blank.ts(pnpm ops business blank [--force])
// src/business/business.ts を source: "own" と空の欄(形は例の値と同じ)にする。全部の欄に値を書いてから本番のビルドへ。
// 既に own なら --force が無い限り書かない。DB・外部には書かない(手元のファイル 1 つ)。詳細: src/lib/business/README.md

import { EXAMPLE_BUSINESS } from "@/lib/business";

import { BUSINESS_FILE, blankValues, ownFileText, writeOwnFile } from "./lib";

const result = writeOwnFile(process.cwd(), ownFileText(blankValues(EXAMPLE_BUSINESS)), process.argv.includes("--force"));
if (!result.written) {
  console.error(`⚠️  ${result.reason}`);
  process.exit(1);
}
console.log(`✅ ${BUSINESS_FILE} を空の欄で own にしました。全部の欄に値を書いてください`);
