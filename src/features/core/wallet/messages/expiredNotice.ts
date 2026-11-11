// src/features/core/wallet/messages/expiredNotice.ts
//
// 失効の本通知(有効期限切れで残高を没収した後)。送り手: services/server/notification/sendExpiredNotices.ts(cron wallet-expiration-notice)
// 経路は wallet の config(expiration[<通貨>].notice.expired.channels)、文面はここ。
// 取引の連絡(好みを見ない)。二重送信の鍵: wallet-expired:<履歴の id>
// メールの描き方: views/expiredNotice.tsx(段落の並びは parts/NoticeMailView.tsx)

import { z } from "zod";

import { defineMessage } from "@/lib/messaging";

export const message = defineMessage({
  key: "wallet.expiredNotice",
  kind: "transactional",
  category: "wallet",
  vars: z.object({
    /** 通貨名(currency の label) */
    currencyLabel: z.string(),
    /** 失効した額(単位付き) */
    amount: z.string(),
    /** 失効処理日 */
    expiredOn: z.string(),
    /** 失効後の残高(単位付き) */
    balanceAfter: z.string(),
    /** 宛名(利用者の名前、無ければ「お客様」) */
    displayName: z.string(),
    /** サービスの短い名前(business.serviceNameShort) */
    serviceNameShort: z.string(),
  }),
  defaultChannels: ["email", "inApp"],
  content: {
    email: {
      subject: "{{currencyLabel}}が失効しました",
      preheader: "【{{serviceNameShort}}】{{currencyLabel}}が失効しました",
      paragraphs: [
        "{{serviceNameShort}} からのお知らせ",
        "{{displayName}} 様",
        "有効期限切れにより {{amount}} が失効しました。\n失効後の残高: {{balanceAfter}}",
      ],
      footer: "ご不明な点がございましたら、\nお気軽にお問い合わせください。",
    },
    inApp: {
      title: "{{currencyLabel}}が失効しました",
      body: "有効期限切れにより {{amount}} が失効しました。（残高: {{balanceAfter}}）",
    },
  },
});
