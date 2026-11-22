// src/features/core/bankTransferReview/messages/transferCheck.ts
//
// お振込の確認のご連絡(上流の手本、D194)。振込審査の管理一覧で選んだ審査の申告者へ、管理者が送る定義連絡。
// 送り手: 記録の宛先 recordTargets/reviews.ts(鍵 bankTransferReview.reviews)の messages が名指し、
// 管理の定義の送る口 POST /api/admin/messaging/definitions/send(記録の入口)で送る。コードからは送らない。
// 記録から埋める値(recordVars): 宛名・選んだ審査の金額と申告日(同じ人の審査はまとめるので「、」でつないだ字)。
// 管理者は送る時に件名・本文などのテキストを編集する(本文の既定は書き出しだけ)。
// カテゴリー bankTransferCheck(種別 transactional、メール・お知らせとも既定で入、D165)。
// レイアウト statement: メールは件名・本文、お知らせの一覧は短い本文(前の一括メールのお知らせの文)

import { z } from "zod";

import { defineMessage } from "@/lib/messaging";

export const message = defineMessage({
  key: "bankTransferReview.transferCheck",
  label: "お振込の確認のご連絡",
  category: "bankTransferCheck",
  vars: z.object({
    /** 宛名(利用者の名前、無ければ「お客様」) */
    displayName: z.string(),
    /** 選んだ審査のお支払い額(「¥1,000、¥2,000」) */
    paymentAmounts: z.string(),
    /** 選んだ審査の申告日(「2026/11/01、2026/11/03」) */
    submittedDates: z.string(),
  }),
  // vars の日本語の別名と説明(D133。{{別名}} でも {{鍵}} と同じ値で埋まる)
  varNames: {
    displayName: { alias: "表示名", description: "受け取る人の宛名(名前が無ければ「お客様」)" },
    paymentAmounts: { alias: "お振込の金額", description: "選んだ振込審査のお支払い額(複数なら「、」でつなぐ)" },
    submittedDates: { alias: "お振込の申告日", description: "選んだ振込審査の申告日(複数なら「、」でつなぐ)" },
  },
  // どれも振込審査の記録から埋める(管理者は入れない)
  recordVars: {
    displayName: { type: "line", required: true },
    paymentAmounts: { type: "line", required: true },
    submittedDates: { type: "line", required: true },
  },
  adminTargets: ["records"],
  layout: "statement",
  values: {
    subject: "お振込に関するお知らせ",
    preheader: "お振込のご確認に関するお知らせです",
    badge: "{{serviceNameShort}} からのお知らせ",
    addressee: "{{displayName}} 様",
    body: "{{submittedDates}} にお申し出いただいたお振込({{paymentAmounts}})について、ご連絡いたします。",
    footer: "ご不明な点がございましたら、\nお気軽にお問い合わせください。",
    shortBody: "お振込のご確認に関する重要なお知らせをメールにて送付しております。お手数をおかけいたしますが、ご確認のほどお願いいたします。",
  },
});
