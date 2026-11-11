// src/features/core/messaging/messages/adminMessage.ts
//
// 管理者の連絡(管理画面から書いて送る。D40)。送り手: services/server/admin/bulkSend.ts(管理の一括送信)。
// 種別の既定は marketing(受信者の好みに従う)。選んだ利用者宛てに限り、送る時に transactional を明示して選べる
// (送り手が定義の写しの kind だけを替える)。文面は管理者が送るたびに書く値(vars)で、文面の中の {{鍵}} はまだ差し込まない。
// 宛名 {{displayName}} は enrichers/displayName.ts が受信者ごとに足す(名前が無ければ「お客様」)。
// 描き方: views/adminMessage.tsx(段落の並びは parts/AnnouncementMailView.tsx)。fork は .replace で管理者の連絡の見た目をまとめて替える

import { z } from "zod";

import { defineMessage } from "@/lib/messaging";

export const message = defineMessage({
  key: "messaging.adminMessage",
  kind: "marketing",
  category: "marketing",
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
  defaultChannels: ["email", "inApp"],
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
