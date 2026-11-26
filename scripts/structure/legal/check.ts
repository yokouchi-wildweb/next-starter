#!/usr/bin/env tsx
// scripts/structure/legal/check.ts — 段階 build の検査(pnpm check legal): 法務の文書が例文(sample)のまま本番でビルドしていないか(設定の議会 L1.24)
//
// src/config/domains/legal.config.ts で documents.<kind> が sample(上流の出荷の状態、上流の例文を表示)の文書が 1 つでもあり、段階が本番
// (@/lib/appEnv の isProduction、APP_ENV が無い・知らない値も本番)なら exit 1。Tier1(repo.json の repo_id が src/lib/CATALOG.md の先頭の節、上流のデモ)は警告だけで exit 0。名前の宣言の誤りは exit 2。
// 全部 own・開発・staging は通す。判定は事業の素性の検査と同じ部品(@/lib/business の sampleReleaseLevel)。
// 直し方: pnpm ops legal from-example [<kind>…](例文を写して own)の後、文面を直す。詳細: src/domains/core/legal/README.md

import path from "node:path";
import { fileURLToPath } from "node:url";

import { sampleLegalDocuments } from "@/domains/legal/documents";
import { checkLegalRelease } from "@/domains/legal/release";
import { isProduction } from "@/lib/appEnv";

import { readTier1 } from "@/lib/forkOwnership/node.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");

// 名前の宣言に誤りがあれば止める(黙って Tier1 でないと見ない。project.md: exit 2)
const tier1Read = readTier1(repoRoot);
if (tier1Read.problem !== undefined) {
  console.error(`❌ legal: repo の名前の宣言に誤り: ${tier1Read.problem}`);
  process.exit(2);
}
const tier1 = tier1Read.tier1;

const samples = sampleLegalDocuments();
const result = checkLegalRelease({ samples, production: isProduction(), tier1 });
if (result.level === "ok") console.log(`legal: sample ${samples.length === 0 ? "なし" : samples.join("・")}(${isProduction() ? "本番" : "本番でない"})`);
else if (result.level === "warn") console.warn(`⚠️  legal(Tier1 なので警告だけ): ${result.message}`);
else {
  console.error(`❌ legal: ${result.message}`);
  process.exit(1);
}
