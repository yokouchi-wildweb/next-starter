// src/features/core/auth/messages/accountLocked.ts
//
// アカウントの永続ロックの知らせ。送り手: services/server/localLogin.ts(送りっぱなし。失敗はログだけ)
// 種類 accountLocked(種別 security、利用者は止められない)。IP は個人の情報なので本文と vars を記録に残さない(record meta)。
// ひな形: alert(セキュリティの警告、messaging/layouts/alert)。ラベルと値の値が空の行(IP が分からない)は描かない。心当たりの段落は最初の行を太字

import { z } from "zod";

import { defineMessage } from "@/lib/messaging";

export const message = defineMessage({
  key: "auth.accountLocked",
  label: "アカウントのロック",
  category: "accountLocked",
  record: "meta",
  vars: z.object({
    /** 発生時刻(表示用の文字列) */
    occurredAt: z.string(),
    /** アクセス元 IP(分からなければ空) */
    ip: z.string(),
  }),
  // vars の日本語の別名と説明(D133。{{別名}} でも {{鍵}} と同じ値で埋まる)
  varNames: {
    occurredAt: { alias: "発生時刻", description: "ロックした時刻(表示用の字)" },
    ip: { alias: "アクセス元IP", description: "ログインを試みたアクセス元の IP(分からなければ空)" },
  },
  layout: "alert",
  values: {
    subject: "【重要】アカウントがセキュリティロックされました",
    preheader: "アカウントがセキュリティロックされました",
    heading: "アカウントがセキュリティロックされました",
    explanation: "ご利用のアカウントで連続したログイン失敗が検知されたため、安全のためアカウントを一時的にロックしました。",
    // 値が空の行(IP が分からない)は描かない
    details: [
      { key: "発生時刻", value: "{{occurredAt}}" },
      { key: "アクセス元 IP", value: "{{ip}}" },
    ],
    notYou: "お心当たりがない場合:\n第三者によるログイン試行の可能性があります。サポートまでご連絡のうえ、パスワード変更をご検討ください。",
    ifYou: "お心当たりがある場合:\nロックを解除するには管理者またはサポートまでご連絡ください。",
    footer: "このメールは自動送信されています。返信は受け付けておりません。",
  },
});
