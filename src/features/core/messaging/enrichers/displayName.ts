// src/features/core/messaging/enrichers/displayName.ts
//
// 宛名 {{displayName}}(利用者の名前、無ければ「お客様」)。種別 announcement・direct・promotion の連絡(管理者がその場で書く連絡・テンプレートの送り、
// D127 の当て先 = 種別)の「… 様」に使う。
// 前の管理者のお知らせのメールの宛名(name ?? 「お客様」)と同じ。共通の文脈の recipientName は名前が無いと空になる

import { z } from "zod";

import type { MessageEnricher } from "@/lib/messaging";

export const enricher: MessageEnricher = {
  key: "displayName",
  target: { kinds: ["announcement", "direct", "promotion"] },
  provides: z.object({ displayName: z.string() }),
  resolve: ({ recipient }) => ({ displayName: recipient.name ?? "お客様" }),
};
