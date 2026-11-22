// src/features/core/wallet/messages/adjustmentNotice.ts
//
// 管理者による残高の変更の知らせ(お知らせ = 受け取り箱だけ)。送り手: services/server/notification/sendAdjustmentNotification.ts
// (管理の残高の変更 /api/admin/wallet/[userId]/adjust で walletConfig.notifyOnAdjust が立つ操作、一括付与 wallet:bulk-grant の notify)
// カテゴリー walletAdjusted(種別 transactional)。{{reasonLine}} = 理由があれば「\n理由: <理由>」、無ければ空(送り手が組む)
// {{methodLabel}} = walletConfig.adjustmentNotification.changeMethodLabels の表示(知らない操作はそのまま)

import { z } from "zod";

import { defineMessage } from "@/lib/messaging";

export const message = defineMessage({
  key: "wallet.adjustmentNotice",
  label: "残高の変更の知らせ",
  category: "walletAdjusted",
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
  // vars の日本語の別名と説明(D133。{{別名}} でも {{鍵}} と同じ値で埋まる)
  varNames: {
    currencyLabel: { alias: "通貨名", description: "変わった残高の通貨の名前" },
    methodLabel: { alias: "操作の種類", description: "増加・減少・残高の設定のどれか" },
    delta: { alias: "変わった額", description: "符号つきの額(例 +1,000 コイン)" },
    balance: { alias: "変更後の残高", description: "変更の後の残高(単位つき)" },
    reasonLine: { alias: "理由の行", description: "変更の理由の行(理由が無ければ空)" },
  },
  layout: "notice",
  values: {
    subject: "{{currencyLabel}}残高が変更されました",
    blocks: [{ type: "paragraph", text: "操作: {{methodLabel}}\n金額: {{delta}}\n残高: {{balance}}{{reasonLine}}" }],
  },
});
