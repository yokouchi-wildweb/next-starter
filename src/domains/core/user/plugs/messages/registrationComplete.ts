// src/domains/core/user/plugs/messages/registrationComplete.ts
//
// 会員登録の完了の知らせ(signupMode が earlyRegistration でないとき)。送り手: services/server/registration/sendRegistrationCompleteMail.ts
// カテゴリー registrationComplete(種別 transactional、好みを見ない)。レイアウト: welcome(ようこそ、messaging/plugs/messagingLayouts/welcome)

import { z } from "zod";

import { defineMessage } from "@/lib/messaging";

export const message = defineMessage({
  key: "user.registrationComplete",
  label: "会員登録の完了",
  category: "registrationComplete",
  vars: z.object({
    /** 表示名(無ければ空) */
    displayName: z.string(),
    /** サービスの短い名前(business.serviceNameShort) */
    serviceNameShort: z.string(),
    /** サイトの URL(business.url。メールの本文の正式な URL) */
    siteUrl: z.string(),
  }),
  // vars の日本語の別名と説明(D133。{{別名}} でも {{鍵}} と同じ値で埋まる)
  varNames: {
    displayName: { alias: "表示名", description: "登録した人の表示名(無ければ空)" },
    serviceNameShort: { alias: "サービスの短い名前", description: "このサービスの短い名前(件名の頭など)" },
    siteUrl: { alias: "サイトの正式なURL", description: "サイトの正式な URL(メールの本文に出す)" },
  },
  layout: "welcome",
  values: {
    subject: "【{{serviceNameShort}}】会員登録が完了しました",
    preheader: "【{{serviceNameShort}}】会員登録が完了しました",
    badge: "登録完了",
    heading: "会員登録が完了しました",
    thanks: "{{displayName}} 様\n\nこの度は、{{serviceNameShort}}に\nご登録いただき、\n誠にありがとうございます。",
    guide: "早速サービスをご利用ください。",
    button: { label: "トップページへ", url: "{{siteUrl}}" },
    footer: "ご不明な点がございましたら、\nお気軽にお問い合わせください。",
  },
});
