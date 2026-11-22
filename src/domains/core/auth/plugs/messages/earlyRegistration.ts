// src/domains/core/auth/plugs/messages/earlyRegistration.ts
//
// 事前登録のメールアドレスの確認(Firebase のサインインのリンク)。送り手: services/server/sendEarlyRegistrationLink.ts
// 止められない連絡(required)。リンクは秘密。レイアウト: link(認証のリンク、messaging/plugs/messagingLayouts/link)

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
  // vars の日本語の別名と説明(D133。{{別名}} でも {{鍵}} と同じ値で埋まる)
  varNames: {
    email: { alias: "登録するメールアドレス", description: "事前登録で入力したメールアドレス" },
    verificationUrl: { alias: "確認のURL", description: "メールアドレスを確かめるリンク(秘密)" },
    serviceNameShort: { alias: "サービスの短い名前", description: "このサービスの短い名前(件名の頭など)" },
  },
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
