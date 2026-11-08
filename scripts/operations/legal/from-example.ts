// scripts/operations/legal/from-example.ts(pnpm ops legal from-example [terms|privacy|tradelaw …] [--force])
// 法務の文書の例文(src/features/core/legal/examples/)を上書き src/config/features/legal.config.ts へ写して source: "own" にする。文面はその後に直す。
// 種類を書かなければ 3 文書とも。既に own の文書は --force が無い限り変えない。DB・外部には書かない(手元のファイル 1 つ)。詳細: src/features/core/legal/README.md

import { writeFileSync } from "node:fs";
import path from "node:path";

import { LEGAL_DOCUMENT_KINDS } from "@/features/legal/constants";
import { LEGAL_EXAMPLES } from "@/features/legal/documents";
import type { LegalDocumentKind } from "@/features/legal/types";

import { LEGAL_OVERRIDE_FILE, overrideFileText, withExamples } from "./lib";

const args = process.argv.slice(2);
const force = args.includes("--force");
const named = args.filter((arg) => !arg.startsWith("--"));
const unknown = named.filter((arg) => !LEGAL_DOCUMENT_KINDS.includes(arg as LegalDocumentKind));
if (unknown.length > 0) {
  console.error(`❌ 知らない文書の種類: ${unknown.join(", ")}(使えるのは ${LEGAL_DOCUMENT_KINDS.join(" / ")})`);
  process.exit(1);
}
const kinds = (named.length > 0 ? named : LEGAL_DOCUMENT_KINDS) as LegalDocumentKind[];

async function main(): Promise<void> {
  const file = path.join(process.cwd(), LEGAL_OVERRIDE_FILE);
  const current = ((await import(file)) as { default: Record<string, unknown> }).default;
  const { value, written, skipped } = withExamples(current, kinds, LEGAL_EXAMPLES, force);
  for (const reason of skipped) console.warn(`⚠️  ${reason}`);
  if (written.length === 0) process.exit(1);
  writeFileSync(file, overrideFileText(value));
  console.log(`✅ ${LEGAL_OVERRIDE_FILE}: ${written.join("・")} を例文の写しで own にしました。このプロジェクトの文面と日付(enactedAt / lastUpdatedAt)に直してください`);
}

void main();
