// src/domains/core/wallet/messages/expiredNotice.ts
//
// 失効の本通知(有効期限切れで残高を没収した後)。送り手: services/server/notification/sendExpiredNotices.ts(cron wallet-expiration-notice)
// 送るかは wallet の config(expiration[<通貨>].notice.expired)、送信チャンネルはカテゴリー、文面はここ。
// カテゴリー walletExpired(種別 transactional)。二重送信の鍵: wallet-expired:<履歴の id>
// レイアウト: statement(明細、messaging/layouts/statement。サービス内通知の一覧は要約 = 件名と短い本文、詳細はレイアウトの描き方)

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
  // vars の日本語の別名と説明(D133。{{別名}} でも {{鍵}} と同じ値で埋まる)
  varNames: {
    currencyLabel: { alias: "通貨名", description: "失効した残高の通貨の名前" },
    amount: { alias: "失効した額", description: "失効した額(単位つき)" },
    expiredOn: { alias: "失効日", description: "失効の処理をした日" },
    balanceAfter: { alias: "失効後の残高", description: "失効の後の残高(単位つき)" },
    displayName: { alias: "表示名", description: "受け取る人の宛名(名前が無ければ「お客様」)" },
    serviceNameShort: { alias: "サービスの短い名前", description: "このサービスの短い名前(件名の頭など)" },
  },
  layout: "statement",
  values: {
    subject: "{{currencyLabel}}が失効しました",
    preheader: "【{{serviceNameShort}}】{{currencyLabel}}が失効しました",
    badge: "{{serviceNameShort}} からのお知らせ",
    addressee: "{{displayName}} 様",
    body: "有効期限切れにより {{amount}} が失効しました。\n失効後の残高: {{balanceAfter}}",
    footer: "ご不明な点がございましたら、\nお気軽にお問い合わせください。",
    shortBody: "有効期限切れにより {{amount}} が失効しました。（残高: {{balanceAfter}}）",
  },
});
