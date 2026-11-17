// src/features/core/auth/messages/verification.ts
//
// 会員登録のメールアドレスの確認(Firebase のサインインのリンク)。送り手: services/server/sendSignInLink.ts
// 止められない連絡(required): 認証の流れがこのメールに依る。リンクは秘密(本文を記録に残さない)。
// ひな形: link(認証のリンク、messaging/layouts/link。ボタンの URL を URL の案内の下にも出す)

import { z } from "zod";

import { defineMessage, secretVar } from "@/lib/messaging";

export const message = defineMessage({
  key: "auth.verification",
  label: "会員登録のメールアドレスの確認",
  category: "emailVerification",
  required: true,
  record: "meta",
  vars: z.object({
    /** 宛先のメールアドレス(本文に出す) */
    email: z.string(),
    /** サインインのリンク(oobCode 入り) */
    verificationUrl: secretVar(z.string().url()),
  }),
  layout: "link",
  values: {
    subject: "メールアドレスの確認",
    preheader: "メールアドレスの確認",
    heading: "メールアドレスの確認",
    received: "{{email}} 宛に登録のリクエストを受け付けました。",
    buttonGuide: "以下のボタンをクリックして、メールアドレスの確認を完了してください。",
    button: { label: "メールアドレスを確認する", url: "{{verificationUrl}}" },
    urlGuide: "ボタンがクリックできない場合は、以下のURLをブラウザに貼り付けてください。",
    footer: "このメールに心当たりがない場合は、無視してください。",
  },
});
