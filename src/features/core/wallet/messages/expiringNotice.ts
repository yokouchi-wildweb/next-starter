// src/features/core/wallet/messages/expiringNotice.ts
//
// 失効の予告(残高の有効期限が近い)。送り手: services/server/notification/sendPreExpiryNotices.ts(cron wallet-expiration-notice)
// 送る段(何日前)と経路は wallet の config(expiration[<通貨>].notice.preExpiry[].channels)、文面はここ。
// 段ごとに文面を変えたいときは override で {{daysBefore}} を使う(段ごとの文面の設定は無い)。
// 種類 walletExpiring(種別 activity = 利用者が止められる失効の予告、D67。経路は種類から)。二重送信の鍵: wallet-expiring:<通貨>:<日数>:<利用者>:<失効日>
// メールの描き方: views/expiringNotice.tsx(段落の並びは parts/NoticeMailView.tsx)

import { z } from "zod";

import { defineMessage } from "@/lib/messaging";

export const message = defineMessage({
  key: "wallet.expiringNotice",
  category: "walletExpiring",
  vars: z.object({
    /** 通貨名(currency の label) */
    currencyLabel: z.string(),
    /** 対象額(単位付き。例 "1,000 コイン") */
    amount: z.string(),
    /** 失効日(複数ロットなら最も早い日) */
    expiresOn: z.string(),
    /** その段の daysBefore */
    daysBefore: z.string(),
    /** 宛名(利用者の名前、無ければ「お客様」) */
    displayName: z.string(),
    /** サービスの短い名前(business.serviceNameShort) */
    serviceNameShort: z.string(),
  }),
  // 管理画面で直せる文言の欄(門 messagingOverrides。URL を持つ cta・preheader・footer はコードだけ)
  adminEditable: ["email.subject", "email.paragraphs", "inApp.title", "inApp.body"],
  content: {
    email: {
      subject: "{{currencyLabel}}の有効期限が近づいています",
      preheader: "【{{serviceNameShort}}】{{currencyLabel}}の有効期限が近づいています",
      paragraphs: [
        "{{serviceNameShort}} からのお知らせ",
        "{{displayName}} 様",
        "{{amount}} が {{expiresOn}} に有効期限を迎えます。\n期限を過ぎた分は失効しますので、お早めにご利用ください。",
      ],
      footer: "ご不明な点がございましたら、\nお気軽にお問い合わせください。",
    },
    inApp: {
      title: "{{currencyLabel}}の有効期限が近づいています",
      body: "{{amount}} が {{expiresOn}} に失効します。",
    },
  },
});
