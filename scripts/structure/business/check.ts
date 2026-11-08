#!/usr/bin/env tsx
// scripts/structure/business/check.ts — 門 build の検査(pnpm check business): 事業の素性が sample のまま本番でビルドしていないか(設定の議会 D88)
//
// src/business/business.ts の source が "sample"(上流の出荷の状態、@/business は例の値を返す)で、段階が本番(@/lib/appEnv の isProduction、
// APP_ENV が無い・知らない値も本番)なら exit 1。Tier1(fork_id = next-starter、上流のデモ)は警告だけで exit 0。own・開発・staging は通す。
// 直し方: pnpm ops business from-example(例を写して own)か pnpm ops business blank(空の欄で own)の後、値を書く。詳細: src/lib/business/README.md

import path from "node:path";
import { fileURLToPath } from "node:url";

import { isProduction } from "@/lib/appEnv";
import { checkBusinessRelease, type BusinessFile } from "@/lib/business";

import businessFile from "../../../src/business/business";
import { readForkIdentity } from "../../../src/lib/forkOwnership/forkIds.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");

function isTier1(root: string): boolean {
  try {
    return readForkIdentity(root).isTier1 === true;
  } catch {
    return false;
  }
}

const file: BusinessFile = businessFile;
const result = checkBusinessRelease({ source: file.source, production: isProduction(), tier1: isTier1(repoRoot) });
if (result.level === "ok") console.log(`business: source ${file.source}(${isProduction() ? "本番" : "本番でない"})`);
else if (result.level === "warn") console.warn(`⚠️  business(Tier1 なので警告だけ): ${result.message}`);
else {
  console.error(`❌ business: ${result.message}`);
  process.exit(1);
}
