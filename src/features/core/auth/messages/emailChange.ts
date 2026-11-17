// src/features/core/auth/messages/emailChange.ts
//
// メールアドレスの変更の確認(新しいアドレスへ送る)。送り手: services/server/sendEmailChangeLink.ts
// 止められない連絡(required)。リンクは秘密。ひな形: link(認証のリンク、messaging/layouts/link)

import { z } from "zod";

import { defineMessage, secretVar } from "@/lib/messaging";

export const message = defineMessage({
  key: "auth.emailChange",
  label: "メールアドレスの変更の確認",
  category: "emailChange",
  required: true,
  record: "meta",
  vars: z.object({
    /** 変更後のメールアドレス(本文に出す) */
    newEmail: z.string(),
    /** 変更の確認のリンク(oobCode 入り) */
    verificationUrl: secretVar(z.string().url()),
  }),
  // vars の日本語の別名と説明(D133。{{別名}} でも {{鍵}} と同じ値で埋まる)
  varNames: {
    newEmail: { alias: "新しいメールアドレス", description: "変更後のメールアドレス" },
    verificationUrl: { alias: "変更の確認のURL", description: "メールアドレスの変更を確かめるリンク(秘密)" },
  },
  layout: "link",
  values: {
    subject: "メールアドレス変更の確認",
    preheader: "メールアドレス変更の確認",
    heading: "メールアドレス変更の確認",
    received: "メールアドレスを {{newEmail}} に変更するリクエストを受け付けました。",
    buttonGuide: "以下のボタンをクリックして、メールアドレスの変更を完了してください。",
    button: { label: "メールアドレスを変更する", url: "{{verificationUrl}}" },
    urlGuide: "ボタンがクリックできない場合は、以下のURLをブラウザに貼り付けてください。",
    footer: "このメールに心当たりがない場合は、無視してください。\nメールアドレスは変更されません。",
  },
});
