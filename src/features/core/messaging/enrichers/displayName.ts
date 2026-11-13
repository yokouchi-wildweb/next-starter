// src/features/core/messaging/enrichers/displayName.ts
//
// 宛名 {{displayName}}(利用者の名前、無ければ「お客様」)。管理者がその場で書く連絡 3 本(messaging.adminAnnouncement・adminDirect・adminMarketing)とテンプレートの送りの「… 様」に使う。
// 前の管理者のお知らせのメールの宛名(name ?? 「お客様」)と同じ。共通の文脈の recipientName は名前が無いと空になる

import { z } from "zod";

import type { MessageEnricher } from "@/lib/messaging";

export const enricher: MessageEnricher = {
  key: "displayName",
  messages: ["messaging.adminAnnouncement", "messaging.adminDirect", "messaging.adminMarketing"],
  provides: z.object({ displayName: z.string() }),
  resolve: ({ recipient }) => ({ displayName: recipient.name ?? "お客様" }),
};
