// src/features/core/auth/messages/accountLocked.ts
//
// アカウントの永続ロックの知らせ。送り手: services/server/localLogin.ts(送りっぱなし。失敗はログだけ)
// 取引の連絡(好みを見ない)。IP は個人の情報なので本文と vars を記録に残さない(record meta)。
// 描き方: views/accountLocked.tsx(段落の並び: [0] 説明 [1] 発生時刻の値 [2] アクセス元 IP の値(空なら行を出さない)
//   [3] 心当たりがない場合 [4] 心当たりがある場合(最初の行を太字)。ラベル「発生時刻」「アクセス元 IP」は描き方が持つ)

import { z } from "zod";

import { defineMessage } from "@/lib/messaging";

export const message = defineMessage({
  key: "auth.accountLocked",
  kind: "transactional",
  category: "account",
  record: "meta",
  vars: z.object({
    /** 発生時刻(表示用の文字列) */
    occurredAt: z.string(),
    /** アクセス元 IP(分からなければ空) */
    ip: z.string(),
  }),
  defaultChannels: ["email"],
  content: {
    email: {
      subject: "【重要】アカウントがセキュリティロックされました",
      preheader: "アカウントがセキュリティロックされました",
      heading: "アカウントがセキュリティロックされました",
      paragraphs: [
        "ご利用のアカウントで連続したログイン失敗が検知されたため、安全のためアカウントを一時的にロックしました。",
        "{{occurredAt}}",
        "{{ip}}",
        "お心当たりがない場合:\n第三者によるログイン試行の可能性があります。サポートまでご連絡のうえ、パスワード変更をご検討ください。",
        "お心当たりがある場合:\nロックを解除するには管理者またはサポートまでご連絡ください。",
      ],
      footer: "このメールは自動送信されています。返信は受け付けておりません。",
    },
  },
});
