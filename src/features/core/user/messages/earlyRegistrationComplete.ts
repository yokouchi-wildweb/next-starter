// src/features/core/user/messages/earlyRegistrationComplete.ts
//
// 事前登録の完了の知らせ(signupMode が earlyRegistration のとき)。送り手: services/server/registration/sendRegistrationCompleteMail.ts
// 種類 registrationComplete(種別 transactional、好みを見ない)。ボタンは無い。描き方: views/earlyRegistrationComplete.tsx(段落の並びは parts/WelcomeMailView.tsx)

import { z } from "zod";

import { defineMessage } from "@/lib/messaging";

export const message = defineMessage({
  key: "user.earlyRegistrationComplete",
  category: "registrationComplete",
  vars: z.object({
    /** 表示名(無ければ空) */
    displayName: z.string(),
    /** サービスの短い名前(business.serviceNameShort) */
    serviceNameShort: z.string(),
  }),
  // 管理画面で直せる文言の欄(門 messagingOverrides。URL を持つ cta・preheader・footer はコードだけ)
  adminEditable: ["email.subject", "email.heading", "email.paragraphs"],
  content: {
    email: {
      subject: "【{{serviceNameShort}}】事前登録が完了しました",
      preheader: "【{{serviceNameShort}}】事前登録が完了しました",
      heading: "事前登録が完了しました",
      paragraphs: [
        "事前登録完了",
        "{{displayName}} 様\n\nこの度は、{{serviceNameShort}}の\n事前登録にお申し込みいただき、\n誠にありがとうございます。",
        "サービス開始時に改めてご案内いたします。\n今しばらくお待ちください。",
      ],
      footer: "ご不明な点がございましたら、\nお気軽にお問い合わせください。",
    },
  },
});
