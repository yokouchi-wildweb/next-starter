// src/domains/core/user/messages/earlyRegistrationComplete.ts
//
// 事前登録の完了の知らせ(signupMode が earlyRegistration のとき)。送り手: services/server/registration/sendRegistrationCompleteMail.ts
// カテゴリー registrationComplete(種別 transactional、好みを見ない)。ボタンは無い。レイアウト: welcome(ようこそ、messaging/layouts/welcome)

import { z } from "zod";

import { defineMessage } from "@/lib/messaging";

export const message = defineMessage({
  key: "user.earlyRegistrationComplete",
  label: "事前登録の完了",
  category: "registrationComplete",
  vars: z.object({
    /** 表示名(無ければ空) */
    displayName: z.string(),
    /** サービスの短い名前(business.serviceNameShort) */
    serviceNameShort: z.string(),
  }),
  // vars の日本語の別名と説明(D133。{{別名}} でも {{鍵}} と同じ値で埋まる)
  varNames: {
    displayName: { alias: "表示名", description: "登録した人の表示名(無ければ空)" },
    serviceNameShort: { alias: "サービスの短い名前", description: "このサービスの短い名前(件名の頭など)" },
  },
  layout: "welcome",
  values: {
    subject: "【{{serviceNameShort}}】事前登録が完了しました",
    preheader: "【{{serviceNameShort}}】事前登録が完了しました",
    badge: "事前登録完了",
    heading: "事前登録が完了しました",
    thanks: "{{displayName}} 様\n\nこの度は、{{serviceNameShort}}の\n事前登録にお申し込みいただき、\n誠にありがとうございます。",
    guide: "サービス開始時に改めてご案内いたします。\n今しばらくお待ちください。",
    footer: "ご不明な点がございましたら、\nお気軽にお問い合わせください。",
  },
});
