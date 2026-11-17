// src/features/core/user/messages/registrationComplete.ts
//
// 会員登録の完了の知らせ(signupMode が earlyRegistration でないとき)。送り手: services/server/registration/sendRegistrationCompleteMail.ts
// 種類 registrationComplete(種別 transactional、好みを見ない)。ひな形: welcome(ようこそ、messaging/layouts/welcome)

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
