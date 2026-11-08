// src/features/core/legal/config.ts
// 法務の文書(利用規約・プライバシーポリシー・特定商取引法に基づく表示)の設定(既定 + 上書き、設定の議会 D21・D23・L1.24)。
// 上書きは src/config/features/legal.config.ts(このファイルだけが読む)。置き方: src/config/README.md。合成: @/lib/defineConfig。形: ./README.md
// 既定は 3 文書とも sample(例文 ./examples/)。fork は pnpm ops legal from-example で例文を写して own にし、文面を直す

import { z } from "zod";

import override from "@/config/features/legal.config";
import { defineConfig, type OverrideOf } from "@/lib/defineConfig";

import type { LegalConfig, LegalDocumentEntry, LegalDocumentKind } from "./types";

const defaults: LegalConfig = {
  documents: {
    terms: { source: "sample" },
    privacy: { source: "sample" },
    tradelaw: { source: "sample" },
  },
  paymentMethods: "クレジット決済、銀行振込、コンビニ払い",
  licenses: [],
  enactedAtFormat: {},
};

const sectionSchema: z.ZodType = z.lazy(() =>
  z.object({
    id: z.string().optional(),
    title: z.string().optional(),
    content: z.array(z.string()).optional(),
    children: z.array(sectionSchema).optional(),
  }),
);

const entrySchema = z.discriminatedUnion("source", [
  z.object({ source: z.literal("sample") }).strict(),
  z.object({
    source: z.literal("own"),
    document: z.object({ title: z.string().min(1), sections: z.array(sectionSchema).min(1) }).passthrough(),
  }),
]);

/** 合成した値の検査: own の文書は文面(題名と節)を持つ。sample は文面を持たない(深い合成で own の文面が残らないように) */
const schema = z
  .object({
    documents: z.object({ terms: entrySchema, privacy: entrySchema, tradelaw: entrySchema }),
    paymentMethods: z.string(),
    licenses: z.array(z.object({ type: z.string(), label: z.string(), details: z.array(z.object({ key: z.string().optional(), value: z.string() })) })),
  })
  .passthrough();

export const legalConfigDef = defineConfig(defaults, { label: "legal", schema });

/**
 * 上書きのファイルの型(`export default { ... } satisfies LegalOverride`)。
 * documents の各文書は印ごと丸ごと書く(own は document が型で必須。深い部分にしない)
 */
export type LegalOverride<E extends object = Record<never, never>> = Omit<OverrideOf<typeof legalConfigDef, E>, "documents"> & {
  documents?: Partial<Record<LegalDocumentKind, LegalDocumentEntry>>;
};

/** 合成済みの設定(読み込み時に 1 回作る) */
export const LEGAL_CONFIG: LegalConfig = legalConfigDef.compose(override);
