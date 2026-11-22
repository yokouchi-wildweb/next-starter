// src/domains/core/wallet/plugs/messages/expiringNotice.ts
//
// 失効の予告(残高の有効期限が近い)。送り手: services/server/notification/sendPreExpiryNotices.ts(cron wallet-expiration-notice)
// 送る段(何日前)は wallet の config(expiration[<通貨>].notice.preExpiry)、送信チャンネルはカテゴリー、文面はここ。
// 段ごとに文面を変えたいときは override で {{daysBefore}} を使う(段ごとの文面の設定は無い)。
// カテゴリー walletExpiring(種別 transactional = 利用者は止められない、送るかは wallet の config の段が決める D207・D208)。二重送信の鍵: wallet-expiring:<通貨>:<日数>:<利用者>:<失効日>
// レイアウト: statement(明細、messaging/plugs/messagingLayouts/statement。サービス内通知の一覧は要約 = 件名と短い本文、詳細はレイアウトの描き方)

import { z } from "zod";

import { defineMessage } from "@/lib/messaging";

export const message = defineMessage({
  key: "wallet.expiringNotice",
  label: "残高の失効の予告",
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
  // vars の日本語の別名と説明(D133。{{別名}} でも {{鍵}} と同じ値で埋まる)
  varNames: {
    currencyLabel: { alias: "通貨名", description: "失効する残高の通貨の名前" },
    amount: { alias: "失効する額", description: "失効する額(単位つき)" },
    expiresOn: { alias: "失効する日", description: "失効する日(いくつもあれば最も早い日)" },
    daysBefore: { alias: "失効までの日数", description: "失効の何日前の知らせか" },
    displayName: { alias: "表示名", description: "受け取る人の宛名(名前が無ければ「お客様」)" },
    serviceNameShort: { alias: "サービスの短い名前", description: "このサービスの短い名前(件名の頭など)" },
  },
  layout: "statement",
  values: {
    subject: "{{currencyLabel}}の有効期限が近づいています",
    preheader: "【{{serviceNameShort}}】{{currencyLabel}}の有効期限が近づいています",
    badge: "{{serviceNameShort}} からのお知らせ",
    addressee: "{{displayName}} 様",
    body: "{{amount}} が {{expiresOn}} に有効期限を迎えます。\n期限を過ぎた分は失効しますので、お早めにご利用ください。",
    footer: "ご不明な点がございましたら、\nお気軽にお問い合わせください。",
    shortBody: "{{amount}} が {{expiresOn}} に失効します。",
  },
});
