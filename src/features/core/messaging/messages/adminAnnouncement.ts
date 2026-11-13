// src/features/core/messaging/messages/adminAnnouncement.ts
//
// 管理者がその場で書いて送る連絡: 種別 announcement の定義(D65・D80・D85)。運営の告知(全員・ロール・宛先の集め方・選んだ利用者)。
// 送り手: services/server/admin(send.ts・bulkSend.ts。送る時は選んだ種別 announcement のカテゴリーに替える)とテンプレートの送り(templateDefinition.ts)。
// 宛先の種類は種別の性質 adminFreeText で確かめる。種別ごとの定義の表は services/server/admin/freeText.ts。
// 文面は管理者が送るたびに書く値(vars)で、文面の中の {{鍵}} はまだ差し込まない。宛名 {{displayName}} は enrichers/displayName.ts が足す。
// 描き方: メールの経路の既定(段落は改行をそのまま)。3 本は同じ欄(fork の .override.ts は鍵ごと)

import { z } from "zod";

import { defineMessage } from "@/lib/messaging";

export const message = defineMessage({
  key: "messaging.adminAnnouncement",
  category: "announcement",
  vars: z.object({
    /** メールの件名 */
    subject: z.string(),
    /** メールの本文(改行はそのまま) */
    body: z.string(),
    /** お知らせの題 */
    inAppTitle: z.string(),
    /** お知らせの本文 */
    inAppBody: z.string(),
    /** サービスの短い名前(business.serviceNameShort) */
    serviceNameShort: z.string(),
  }),
  content: {
    email: {
      subject: "{{subject}}",
      preheader: "【{{serviceNameShort}}】{{subject}}",
      paragraphs: ["{{serviceNameShort}} からのお知らせ", "{{displayName}} 様", "{{body}}"],
      footer: "ご不明な点がございましたら、\nお気軽にお問い合わせください。",
    },
    inApp: {
      title: "{{inAppTitle}}",
      body: "{{inAppBody}}",
    },
  },
});
