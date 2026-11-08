// src/lib/business/business.ts — 受付係の判定と本番の検査(純関数。値は src/wiring/business.ts が結ぶ)

import { EXAMPLE_BUSINESS } from "./examples/business";
import type { BusinessFile, BusinessSource, BusinessValues } from "./types";

/** src/business/business.ts の中身から、使う値を決める(sample = 例の値、own = 自分の値) */
export function resolveBusiness(file: BusinessFile): BusinessValues {
  return file.source === "own" ? file.values : EXAMPLE_BUSINESS;
}

/** 本番のビルドの検査の結果 */
export type BusinessReleaseCheck = { level: "ok" | "warn" | "error"; message: string | null };

/**
 * sample のまま本番でビルドしていないか(D88)。Tier1(上流のデモ)だけ警告にする。開発・staging は通す
 * @param input.source src/business/business.ts の印
 * @param input.production 本番の段階か(@/lib/appEnv の isProduction)
 * @param input.tier1 fork_id が Tier1 か
 */
export function checkBusinessRelease(input: { source: BusinessSource; production: boolean; tier1: boolean }): BusinessReleaseCheck {
  if (input.source === "own" || !input.production) return { level: "ok", message: null };
  const message =
    "src/business/business.ts が source: \"sample\" のまま(例の値)で本番のビルドをしています。" +
    "pnpm ops business from-example(例を写す)か pnpm ops business blank(空の欄)で own にして、このプロジェクトの値を書いてください";
  return { level: input.tier1 ? "warn" : "error", message };
}
