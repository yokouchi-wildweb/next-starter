// src/features/core/auth/messages/earlyRegistration.ts
//
// 事前登録のメールアドレスの確認(Firebase のサインインのリンク)。送り手: services/server/sendEarlyRegistrationLink.ts
// 止められない連絡(required)。リンクは秘密。ひな形: link(認証のリンク、messaging/layouts/link)

import { z } from "zod";

import { defineMessage, secretVar } from "@/lib/messaging";

export const message = defineMessage({
  key: "auth.earlyRegistration",
  label: "事前登録のメールアドレスの確認",
  category: "earlyRegistration",
  required: true,
  record: "meta",
  vars: z.object({
    email: z.string(),
    verificationUrl: secretVar(z.string().url()),
    /** サービスの短い名前(business.serviceNameShort) */
    serviceNameShort: z.string(),
  }),
  layout: "link",
  values: {
    subject: "【{{serviceNameShort}}】事前登録のメールアドレス確認",
    preheader: "【{{serviceNameShort}}】事前登録のメールアドレス確認",
    heading: "事前登録のメールアドレス確認",
    received: "{{email}} 宛に事前登録のリクエストを受け付けました。",
    buttonGuide: "以下のボタンをクリックして、メールアドレスの確認を完了してください。",
    button: { label: "メールアドレスを確認する", url: "{{verificationUrl}}" },
    urlGuide: "ボタンがクリックできない場合は、以下のURLをブラウザに貼り付けてください。",
    footer: "このメールに心当たりがない場合は、無視してください。",
  },
});
