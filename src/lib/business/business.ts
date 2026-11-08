// src/lib/business/business.ts — 受付係の判定と本番の検査(純関数。値は src/wiring/business.ts が結ぶ)

import { EXAMPLE_BUSINESS } from "./examples/business";
import type { BusinessFile, BusinessSource, BusinessValues } from "./types";

/**
 * src/business/business.ts の中身から、使う値を決める(sample = 例の値、own = 自分の値)
 * @param examples sample のときに返す例の値(既定 = 上流の例 EXAMPLE_BUSINESS。他のプロジェクトに組み込むときは自分の例を渡せる)
 */
export function resolveBusiness(file: BusinessFile, examples: BusinessValues = EXAMPLE_BUSINESS): BusinessValues {
  return file.source === "own" ? file.values : examples;
}

/** 本番のビルドの検査の結果 */
export type BusinessReleaseCheck = { level: "ok" | "warn" | "error"; message: string | null };

/** 例(sample)のまま本番でビルドしたときの重さ */
export type SampleReleaseLevel = BusinessReleaseCheck["level"];

/**
 * 例(sample)のまま本番でビルドしていないかの判定の部品(D88・L1.24)。sample の物が無いか本番でなければ ok、
 * あれば error、Tier1(上流のデモ)だけ warn。事業の素性(checkBusinessRelease)と法務の文書(legal の checkLegalRelease)が共有する
 */
export function sampleReleaseLevel(input: { hasSample: boolean; production: boolean; tier1: boolean }): SampleReleaseLevel {
  if (!input.hasSample || !input.production) return "ok";
  return input.tier1 ? "warn" : "error";
}

/**
 * sample のまま本番でビルドしていないか(D88)。Tier1(上流のデモ)だけ警告にする。開発・staging は通す
 * @param input.source src/business/business.ts の印
 * @param input.production 本番の段階か(@/lib/appEnv の isProduction)
 * @param input.tier1 fork_id が Tier1 か
 */
export function checkBusinessRelease(input: { source: BusinessSource; production: boolean; tier1: boolean }): BusinessReleaseCheck {
  const level = sampleReleaseLevel({ hasSample: input.source === "sample", production: input.production, tier1: input.tier1 });
  if (level === "ok") return { level, message: null };
  const message =
    "src/business/business.ts が source: \"sample\" のまま(例の値)で本番のビルドをしています。" +
    "pnpm ops business from-example(例を写す)か pnpm ops business blank(空の欄)で own にして、このプロジェクトの値を書いてください";
  return { level, message };
}
