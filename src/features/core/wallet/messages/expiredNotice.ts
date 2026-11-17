// src/features/core/wallet/messages/expiredNotice.ts
//
// 失効の本通知(有効期限切れで残高を没収した後)。送り手: services/server/notification/sendExpiredNotices.ts(cron wallet-expiration-notice)
// 経路は wallet の config(expiration[<通貨>].notice.expired.channels)、文面はここ。
// 種類 walletExpired(種別 transactional)。二重送信の鍵: wallet-expired:<履歴の id>
// ひな形: statement(お知らせの明細、messaging/layouts/statement。お知らせは要約 = 件名と本文)

import { z } from "zod";

import { defineMessage } from "@/lib/messaging";

export const message = defineMessage({
  key: "wallet.expiredNotice",
  label: "残高の失効の知らせ",
  category: "walletExpired",
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
  layout: "statement",
  values: {
    subject: "{{currencyLabel}}が失効しました",
    preheader: "【{{serviceNameShort}}】{{currencyLabel}}が失効しました",
    badge: "{{serviceNameShort}} からのお知らせ",
    addressee: "{{displayName}} 様",
    body: "有効期限切れにより {{amount}} が失効しました。\n失効後の残高: {{balanceAfter}}",
    footer: "ご不明な点がございましたら、\nお気軽にお問い合わせください。",
  },
});
