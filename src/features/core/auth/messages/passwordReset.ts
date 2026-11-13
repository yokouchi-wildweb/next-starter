// src/features/core/auth/messages/passwordReset.ts
//
// パスワードの再設定のリンク。送り手: services/server/sendPasswordResetLink.ts
// 止められない連絡(required)。リンクは秘密。描き方: views/passwordReset.tsx(段落の並びは verification と同じ)

import { z } from "zod";

import { defineMessage, secretVar } from "@/lib/messaging";

export const message = defineMessage({
  key: "auth.passwordReset",
  category: "passwordReset",
  required: true,
  record: "meta",
  vars: z.object({
    /** 再設定のリンク(oobCode 入り) */
    resetUrl: secretVar(z.string().url()),
  }),
  content: {
    email: {
      subject: "パスワードのリセット",
      preheader: "パスワードのリセット",
      heading: "パスワードのリセット",
      paragraphs: [
        "パスワードリセットのリクエストを受け付けました。",
        "以下のボタンをクリックして、新しいパスワードを設定してください。",
        "ボタンがクリックできない場合は、以下のURLをブラウザに貼り付けてください。",
      ],
      cta: { label: "パスワードをリセットする", url: "{{resetUrl}}" },
      footer: "このメールに心当たりがない場合は、無視してください。\nパスワードは変更されません。",
    },
  },
});
