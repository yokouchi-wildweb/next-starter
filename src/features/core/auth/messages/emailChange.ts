// src/features/core/auth/messages/emailChange.ts
//
// メールアドレスの変更の確認(新しいアドレスへ送る)。送り手: services/server/sendEmailChangeLink.ts
// 止められない連絡(required)。リンクは秘密。描き方: views/emailChange.tsx(段落の並びは verification と同じ)

import { z } from "zod";

import { defineMessage, secretVar } from "@/lib/messaging";

export const message = defineMessage({
  key: "auth.emailChange",
  category: "emailChange",
  required: true,
  record: "meta",
  vars: z.object({
    /** 変更後のメールアドレス(本文に出す) */
    newEmail: z.string(),
    /** 変更の確認のリンク(oobCode 入り) */
    verificationUrl: secretVar(z.string().url()),
  }),
  content: {
    email: {
      subject: "メールアドレス変更の確認",
      preheader: "メールアドレス変更の確認",
      heading: "メールアドレス変更の確認",
      paragraphs: [
        "メールアドレスを {{newEmail}} に変更するリクエストを受け付けました。",
        "以下のボタンをクリックして、メールアドレスの変更を完了してください。",
        "ボタンがクリックできない場合は、以下のURLをブラウザに貼り付けてください。",
      ],
      cta: { label: "メールアドレスを変更する", url: "{{verificationUrl}}" },
      footer: "このメールに心当たりがない場合は、無視してください。\nメールアドレスは変更されません。",
    },
  },
});
