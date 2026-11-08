// scripts/operations/business/from-example.ts(pnpm ops business from-example [--force])
// 事業の素性の例の値(src/lib/business/examples/business.ts)を src/business/business.ts へ写して source: "own" にする。値はその後に書き換える。
// 既に own なら --force が無い限り書かない。DB・外部には書かない(手元のファイル 1 つ)。詳細: src/lib/business/README.md

import { EXAMPLE_BUSINESS } from "@/lib/business";

import { BUSINESS_FILE, ownFileText, writeOwnFile } from "./lib";

const result = writeOwnFile(process.cwd(), ownFileText(EXAMPLE_BUSINESS), process.argv.includes("--force"));
if (!result.written) {
  console.error(`⚠️  ${result.reason}`);
  process.exit(1);
}
console.log(`✅ ${BUSINESS_FILE} を例の値で own にしました。このプロジェクトの値に書き換えてください`);
