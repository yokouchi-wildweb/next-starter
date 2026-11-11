// src/features/core/auth/messages/earlyRegistration.ts
//
// 事前登録のメールアドレスの確認(Firebase のサインインのリンク)。送り手: services/server/sendEarlyRegistrationLink.ts
// 止められない連絡(required)。リンクは秘密。描き方: views/earlyRegistration.tsx(段落の並びは verification と同じ)

import { z } from "zod";

import { defineMessage, secretVar } from "@/lib/messaging";

export const message = defineMessage({
  key: "auth.earlyRegistration",
  kind: "transactional",
  category: "account",
  required: true,
  record: "meta",
  vars: z.object({
    email: z.string(),
    verificationUrl: secretVar(z.string().url()),
    /** サービスの短い名前(business.serviceNameShort) */
    serviceNameShort: z.string(),
  }),
  defaultChannels: ["email"],
  content: {
    email: {
      subject: "【{{serviceNameShort}}】事前登録のメールアドレス確認",
      preheader: "【{{serviceNameShort}}】事前登録のメールアドレス確認",
      heading: "事前登録のメールアドレス確認",
      paragraphs: [
        "{{email}} 宛に事前登録のリクエストを受け付けました。",
        "以下のボタンをクリックして、メールアドレスの確認を完了してください。",
        "ボタンがクリックできない場合は、以下のURLをブラウザに貼り付けてください。",
      ],
      cta: { label: "メールアドレスを確認する", url: "{{verificationUrl}}" },
      footer: "このメールに心当たりがない場合は、無視してください。",
    },
  },
});
