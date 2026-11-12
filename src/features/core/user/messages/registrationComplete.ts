// src/features/core/user/messages/registrationComplete.ts
//
// 会員登録の完了の知らせ(signupMode が earlyRegistration でないとき)。送り手: services/server/registration/sendRegistrationCompleteMail.ts
// 取引の連絡(好みを見ない)。描き方: views/registrationComplete.tsx(段落の並びは parts/WelcomeMailView.tsx)

import { z } from "zod";

import { defineMessage } from "@/lib/messaging";

export const message = defineMessage({
  key: "user.registrationComplete",
  kind: "transactional",
  vars: z.object({
    /** 表示名(無ければ空) */
    displayName: z.string(),
    /** サービスの短い名前(business.serviceNameShort) */
    serviceNameShort: z.string(),
    /** サイトの URL(business.url。メールの本文の正式な URL) */
    siteUrl: z.string(),
  }),
  // 管理画面で直せる文言の欄(門 messagingOverrides。URL を持つ cta・preheader・footer はコードだけ)
  adminEditable: ["email.subject", "email.heading", "email.paragraphs"],
  defaultChannels: ["email"],
  content: {
    email: {
      subject: "【{{serviceNameShort}}】会員登録が完了しました",
      preheader: "【{{serviceNameShort}}】会員登録が完了しました",
      heading: "会員登録が完了しました",
      paragraphs: [
        "登録完了",
        "{{displayName}} 様\n\nこの度は、{{serviceNameShort}}に\nご登録いただき、\n誠にありがとうございます。",
        "早速サービスをご利用ください。",
      ],
      cta: { label: "トップページへ", url: "{{siteUrl}}" },
      footer: "ご不明な点がございましたら、\nお気軽にお問い合わせください。",
    },
  },
});
