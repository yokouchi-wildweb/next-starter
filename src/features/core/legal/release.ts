// src/features/core/legal/release.ts — 法務の文書が例文(sample)のまま本番でビルドしていないかの検査(L1.24)
// 判定は事業の素性と同じ部品(@/lib/business の sampleReleaseLevel)。入口: pnpm check legal(scripts/structure/legal/check.ts)

import { sampleReleaseLevel, type BusinessReleaseCheck } from "@/lib/business";

import type { LegalDocumentKind } from "./types";

/**
 * @param input.samples sample のままの文書の種類(sampleLegalDocuments)
 * @param input.production 本番の段階か(@/lib/appEnv の isProduction)
 * @param input.tier1 fork_id が Tier1 か
 */
export function checkLegalRelease(input: { samples: LegalDocumentKind[]; production: boolean; tier1: boolean }): BusinessReleaseCheck {
  const level = sampleReleaseLevel({ hasSample: input.samples.length > 0, production: input.production, tier1: input.tier1 });
  if (level === "ok") return { level, message: null };
  const message =
    `法務の文書 ${input.samples.join("・")} が source: "sample"(上流の例文)のまま本番のビルドをしています。` +
    `pnpm ops legal from-example ${input.samples.join(" ")} で例文を src/config/features/legal.config.ts へ写して own にし、このプロジェクトの文面に直してください`;
  return { level, message };
}
