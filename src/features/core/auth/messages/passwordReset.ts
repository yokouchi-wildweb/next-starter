// src/features/core/auth/messages/passwordReset.ts
//
// パスワードの再設定のリンク。送り手: services/server/sendPasswordResetLink.ts
// 止められない連絡(required)。リンクは秘密。ひな形: link(認証のリンク、messaging/layouts/link)

import { z } from "zod";

import { defineMessage, secretVar } from "@/lib/messaging";

export const message = defineMessage({
  key: "auth.passwordReset",
  label: "パスワードの再設定",
  category: "passwordReset",
  required: true,
  record: "meta",
  vars: z.object({
    /** 再設定のリンク(oobCode 入り) */
    resetUrl: secretVar(z.string().url()),
  }),
  layout: "link",
  values: {
    subject: "パスワードのリセット",
    preheader: "パスワードのリセット",
    heading: "パスワードのリセット",
    received: "パスワードリセットのリクエストを受け付けました。",
    buttonGuide: "以下のボタンをクリックして、新しいパスワードを設定してください。",
    button: { label: "パスワードをリセットする", url: "{{resetUrl}}" },
    urlGuide: "ボタンがクリックできない場合は、以下のURLをブラウザに貼り付けてください。",
    footer: "このメールに心当たりがない場合は、無視してください。\nパスワードは変更されません。",
  },
});
