// src/features/core/wallet/messages/adjustmentNotice.ts
//
// 管理者による残高の変更の知らせ(お知らせ = 受け取り箱だけ)。送り手: services/server/notification/sendAdjustmentNotification.ts
// (管理の残高の変更 /api/admin/wallet/[userId]/adjust で walletConfig.notifyOnAdjust が立つ操作、一括付与 wallet:bulk-grant の notify)
// 取引の連絡(好みを見ない)。{{reasonLine}} = 理由があれば「\n理由: <理由>」、無ければ空(送り手が組む)
// {{methodLabel}} = walletConfig.adjustmentNotification.changeMethodLabels の表示(知らない操作はそのまま)

import { z } from "zod";

import { defineMessage } from "@/lib/messaging";

export const message = defineMessage({
  key: "wallet.adjustmentNotice",
  kind: "transactional",
  category: "wallet",
  vars: z.object({
    /** 通貨名(currency の label) */
    currencyLabel: z.string(),
    /** 操作の表示(増加・減少・残高設定) */
    methodLabel: z.string(),
    /** 符号付きの額(例 "+1,000 コイン") */
    delta: z.string(),
    /** 変更後の残高(単位付き) */
    balance: z.string(),
    /** 理由の行(先頭の改行込み。理由が無ければ空) */
    reasonLine: z.string(),
  }),
  // 管理画面で直せる文言の欄(門 messagingOverrides。URL を持つ cta・preheader・footer はコードだけ)
  adminEditable: ["inApp.title", "inApp.body"],
  defaultChannels: ["inApp"],
  content: {
    inApp: {
      title: "{{currencyLabel}}残高が変更されました",
      body: "操作: {{methodLabel}}\n金額: {{delta}}\n残高: {{balance}}{{reasonLine}}",
    },
  },
});
