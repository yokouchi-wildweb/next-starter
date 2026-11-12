// src/features/core/auth/messages/verification.ts
//
// 会員登録のメールアドレスの確認(Firebase のサインインのリンク)。送り手: services/server/sendSignInLink.ts
// 止められない連絡(required): 認証の流れがこのメールに依る。リンクは秘密(本文を記録に残さない)。
// 描き方: views/verification.tsx(段落の並び: [0] 受付 [1] ボタンの案内 [2] URL の案内。cta の URL を [2] の下にも出す)

import { z } from "zod";

import { defineMessage, secretVar } from "@/lib/messaging";

export const message = defineMessage({
  key: "auth.verification",
  kind: "transactional",
  required: true,
  record: "meta",
  vars: z.object({
    /** 宛先のメールアドレス(本文に出す) */
    email: z.string(),
    /** サインインのリンク(oobCode 入り) */
    verificationUrl: secretVar(z.string().url()),
  }),
  defaultChannels: ["email"],
  content: {
    email: {
      subject: "メールアドレスの確認",
      preheader: "メールアドレスの確認",
      heading: "メールアドレスの確認",
      paragraphs: [
        "{{email}} 宛に登録のリクエストを受け付けました。",
        "以下のボタンをクリックして、メールアドレスの確認を完了してください。",
        "ボタンがクリックできない場合は、以下のURLをブラウザに貼り付けてください。",
      ],
      cta: { label: "メールアドレスを確認する", url: "{{verificationUrl}}" },
      footer: "このメールに心当たりがない場合は、無視してください。",
    },
  },
});
